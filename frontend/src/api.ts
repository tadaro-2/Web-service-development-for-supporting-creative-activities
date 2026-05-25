export type ApiError = {
  status: number;
  message: string;
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api';

const DEFAULT_TIMEOUT_MS = 8000;

function getAccessToken(): string | null {
  return localStorage.getItem('access_token');
}

export function setTokens(tokens: { access: string; refresh?: string }) {
  localStorage.setItem('access_token', tokens.access);
  if (tokens.refresh) localStorage.setItem('refresh_token', tokens.refresh);
}

export function clearTokens() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

async function parseError(res: Response): Promise<ApiError> {
  let message = res.statusText || 'Request failed';
  try {
    const data: unknown = await res.json();
    if (data && typeof data === 'object' && 'detail' in data && typeof (data as any).detail === 'string') {
      message = (data as any).detail;
    } else if (data && typeof data === 'object') {
      // DRF validation errors usually come as { field: ["msg"] } or { non_field_errors: [...] }
      const obj = data as Record<string, unknown>;
      const parts: string[] = [];
      for (const [key, val] of Object.entries(obj)) {
        if (typeof val === 'string') parts.push(`${key}: ${val}`);
        else if (Array.isArray(val) && val.length && typeof val[0] === 'string') {
          parts.push(`${key}: ${val[0]}`);
        }
      }
      if (parts.length) message = parts.join(' | ');
    }
  } catch {
    // ignore
  }
  return { status: res.status, message };
}

type ApiFetchOptions = {
  auth?: boolean;
  /** Переопределение таймаута (например, для запросов к ИИ). */
  timeoutMs?: number;
};

export async function apiFetch<T>(path: string, init: RequestInit = {}, options: ApiFetchOptions = {}): Promise<T> {
  const headers = new Headers(init.headers);
  // If body is FormData, the browser will set the correct multipart boundary.
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (!isFormData) headers.set('Content-Type', 'application/json');
  const useAuth = options.auth !== false;
  if (useAuth) {
    const token = getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let res: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw {
        status: 0,
        message: `Timeout: backend did not respond in ${timeoutMs / 1000}s (check Django is running on :8000).`,
      } satisfies ApiError;
    }
    throw {
      status: 0,
      message:
        'Network/CORS error: backend is unreachable or blocked by CORS. Check that Django is running on :8000 and CORS allows your frontend URL.',
    } satisfies ApiError;
  } finally {
    clearTimeout(timeout);
  }
  if (res.status === 401 && useAuth) {
    // If the stored token is invalid/expired, it can break even AllowAny endpoints when sent.
    // Clearing helps recover on next auth attempt.
    clearTokens();
  }
  if (!res.ok) throw await parseError(res);
  const text = await res.text();
  if (!text.trim()) {
    return undefined as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

export async function register(payload: { email: string; password: string; role?: string }) {
  return apiFetch<{ user: any; message: string }>('/auth/register/', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, { auth: false });
}

export async function verifyEmail(payload: { email: string; code: string }) {
  return apiFetch<{ user: any; access: string; refresh: string; onboarding_required?: boolean }>(
    '/auth/verify-email/',
    {
    method: 'POST',
    body: JSON.stringify(payload),
    },
    { auth: false },
  );
}

export async function resendCode(payload: { email: string }) {
  return apiFetch<{ message: string }>('/auth/resend-code/', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, { auth: false });
}

export async function login(payload: { email: string; password: string }) {
  return apiFetch<{ access: string; refresh: string; onboarding_required?: boolean }>('/auth/token/', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, { auth: false });
}

export async function me() {
  return apiFetch<{
    id: number;
    email: string;
    role: string;
    email_verified: boolean;
    date_joined: string;
    onboarding_completed?: boolean;
    is_admin?: boolean;
  }>('/auth/me/', { method: 'GET' });
}

/** Фиксирует визит за сегодня (локальная дата сервера) и возвращает серию и дни с активностью. */
export type ActivitySummary = { streak: number; active_dates: string[] };

export async function activityPing() {
  return apiFetch<ActivitySummary>('/activity/ping/', { method: 'POST', body: '{}' });
}

export async function getActivitySummary() {
  return apiFetch<ActivitySummary>('/activity/summary/', { method: 'GET' });
}

export type SurveyQuestion = {
  id: string;
  text: string;
  type: 'single' | 'multi';
  max?: number;
  options: { label: string; tag: string }[];
};

export async function getSurvey() {
  return apiFetch<{ completed: boolean; questions: SurveyQuestion[] }>('/onboarding/survey/', { method: 'GET' });
}

export async function submitSurvey(payload: {
  q1_experience: string;
  q2_frequency: string;
  q3_status: string;
  q4_directions: string[];
  q5_difficulties?: string[];
}) {
  return apiFetch<{ completed: true; assigned_tags: string[] }>('/onboarding/survey/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function myTags() {
  const data = await apiFetch<
    | Array<{ id: number; name: string; category: string }>
    | { results: Array<{ id: number; name: string; category: string }> }
  >('/tags/me/', { method: 'GET' });
  return Array.isArray(data) ? data : data.results;
}

export type AchievementDto = { id: number; title: string; received_at: string };

export type MyProfile = {
  user_id: number;
  email: string;
  nickname: string | null;
  display_name: string;
  bio: string;
  level: string;
  avatar: string | null;
  avatar_url: string | null;
  onboarding_completed: boolean;
  onboarding_completed_at: string | null;
  achievements?: AchievementDto[];
};

export async function myProfile() {
  return apiFetch<MyProfile>('/profile/me/', { method: 'GET' });
}

const AI_REQUEST_TIMEOUT_MS = 120_000;

/** По словам пользователя — текстовое описание воображаемой картины (ассоциации). */
export async function aiAssociations(words: string) {
  return apiFetch<{ description: string; id: number; bookmarked: boolean }>(
    '/creative/ai/associations/',
    { method: 'POST', body: JSON.stringify({ words }) },
    { timeoutMs: AI_REQUEST_TIMEOUT_MS },
  );
}

/** Случайное словосочетание для задания; тема необязательна. */
export async function aiRandomPhrase(theme?: string) {
  const body = theme?.trim() ? JSON.stringify({ theme: theme.trim() }) : '{}';
  return apiFetch<{ phrase: string; id: number; bookmarked: boolean }>(
    '/creative/ai/random-phrase/',
    { method: 'POST', body },
    { timeoutMs: AI_REQUEST_TIMEOUT_MS },
  );
}

export async function updateMyProfile(payload: Partial<{ nickname: string; bio: string; level: string }>) {
  return apiFetch<MyProfile>('/profile/me/', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function uploadMyAvatar(file: File) {
  const fd = new FormData();
  fd.append('avatar', file);
  return apiFetch<MyProfile>('/profile/me/', {
    method: 'PATCH',
    body: fd,
  });
}

export async function checkNickname(nickname: string) {
  const q = encodeURIComponent(nickname);
  return apiFetch<{ available: boolean }>(`/profile/check-nickname/?nickname=${q}`, { method: 'GET' });
}

// ——— Публикации и контент ———

export type TagDto = { id: number; name: string; category: string };

export type AuthorMini = {
  user_id: number;
  nickname: string | null;
  display_name: string;
  avatar_url: string | null;
};

export type PostImage = { id: number; type: string; display_url: string };

export type FeedPost = {
  id: number;
  author: AuthorMini;
  title: string;
  description: string;
  status: string;
  rejection_reason?: string;
  created_at: string;
  /** Дата и время публикации в ленте (после одобрения модератором); для черновиков/ожидания — null */
  published_at: string | null;
  tags: TagDto[];
  images: PostImage[];
  likes_count: number;
  comments_count: number;
  liked_by_me: boolean;
  bookmarked_by_me: boolean;
};

export async function getTagsCatalog() {
  const data = await apiFetch<TagDto[] | { results: TagDto[] }>('/tags/catalog/', { method: 'GET' });
  return Array.isArray(data) ? data : data.results;
}

export async function getFeed() {
  const data = await apiFetch<FeedPost[] | { results: FeedPost[] }>('/posts/feed/', { method: 'GET' });
  return Array.isArray(data) ? data : data.results;
}

export async function getMyPosts() {
  return apiFetch<FeedPost[]>('/posts/my/', { method: 'GET' });
}

export async function getBookmarkedPosts() {
  return apiFetch<FeedPost[]>('/posts/bookmarks/', { method: 'GET' });
}

export async function getPostById(id: number) {
  return apiFetch<FeedPost>(`/posts/${id}/`, { method: 'GET' });
}

export async function submitPost(payload: {
  title: string;
  description: string;
  tagIds: number[];
  images: File[];
}) {
  const fd = new FormData();
  fd.append('title', payload.title);
  fd.append('description', payload.description);
  fd.append('tag_ids', JSON.stringify(payload.tagIds));
  for (const f of payload.images) {
    fd.append('images', f);
  }
  return apiFetch<FeedPost>('/posts/submit/', { method: 'POST', body: fd });
}

export async function getPendingPosts() {
  return apiFetch<FeedPost[]>('/posts/pending/', { method: 'GET' });
}

export async function moderatePost(postId: number, action: 'approve' | 'reject', reason?: string) {
  return apiFetch<FeedPost>(`/posts/${postId}/moderate/`, {
    method: 'POST',
    body: JSON.stringify({ action, reason: reason ?? '' }),
  });
}

/** Полное удаление публикации (автор или админ). Ответ 204 без тела. */
export async function deletePost(postId: number) {
  return apiFetch<void>(`/posts/${postId}/`, { method: 'DELETE' });
}

export async function togglePostLike(postId: number) {
  return apiFetch<{ liked: boolean; likes_count: number }>(`/posts/${postId}/like/`, { method: 'POST', body: '{}' });
}

export async function togglePostBookmark(postId: number) {
  return apiFetch<{ saved: boolean }>(`/posts/${postId}/bookmark/`, { method: 'POST', body: '{}' });
}

export type CommentDto = {
  id: number;
  text: string;
  created_at: string;
  author: AuthorMini;
};

export async function getPostComments(postId: number) {
  return apiFetch<CommentDto[]>(`/posts/${postId}/comments/`, { method: 'GET' });
}

export async function addPostComment(postId: number, text: string) {
  return apiFetch<CommentDto>(`/posts/${postId}/comments/`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export type PublicProfileDto = {
  user_id: number;
  nickname: string | null;
  display_name: string;
  bio: string;
  level: string;
  avatar_url: string | null;
  tags: TagDto[];
  achievements: { id: number; title: string; received_at: string }[];
  published_posts: FeedPost[];
};

export async function getPublicProfile(userId: number) {
  return apiFetch<PublicProfileDto>(`/users/${userId}/profile/`, { method: 'GET' });
}

export type MaterialSocialLink = { label: string; url: string };

export type MaterialDto = {
  id: number;
  title: string;
  description: string;
  type: string;
  external_url: string;
  /** Превью со страницы по external_url (og:image) или прямая ссылка на изображение */
  cover_url?: string;
  content_author?: string;
  author_social_links?: MaterialSocialLink[];
  created_at: string;
  tags: TagDto[];
  bookmarked_by_me?: boolean;
};

export async function getMaterials(params?: { type?: string; tag?: number; for_me?: boolean }) {
  const q = new URLSearchParams();
  if (params?.type) q.set('type', params.type);
  if (params?.tag != null && params.tag !== undefined) q.set('tag', String(params.tag));
  if (params?.for_me) q.set('for_me', '1');
  const qs = q.toString();
  const path = qs ? `/materials/?${qs}` : '/materials/';
  const data = await apiFetch<MaterialDto[] | { results: MaterialDto[] }>(path, { method: 'GET' });
  return Array.isArray(data) ? data : data.results;
}

export async function toggleMaterialBookmark(materialId: number) {
  return apiFetch<{ saved: boolean }>(`/materials/${materialId}/bookmark/`, { method: 'POST', body: '{}' });
}

export async function createMaterial(payload: {
  title: string;
  description: string;
  type: string;
  external_url: string;
  content_author: string;
  author_social_links?: MaterialSocialLink[];
  tag_ids: number[];
}) {
  return apiFetch<MaterialDto>('/materials/manage/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Полное удаление материала из каталога (только админ). Ответ 204 без тела. */
export async function deleteMaterial(materialId: number) {
  return apiFetch<void>(`/materials/${materialId}/`, { method: 'DELETE' });
}

export type AiGenerationDto = {
  id: number;
  type: string;
  input_text: string;
  result_text: string;
  created_at: string;
};

export type PaletteColorEntry = {
  hex: string;
  label: string;
};

export type PaletteDto = {
  id: number;
  description: string;
  source: string;
  colors: PaletteColorEntry[];
};

/** Сгенерировать палитру согласованных цветов (OpenAI). */
export async function generatePalette(hint?: string) {
  const body = hint?.trim() ? JSON.stringify({ hint: hint.trim() }) : '{}';
  return apiFetch<{ palette: PaletteDto; id: number; bookmarked: boolean }>(
    '/creative/palettes/generate/',
    { method: 'POST', body },
    { timeoutMs: AI_REQUEST_TIMEOUT_MS },
  );
}

export type BookmarksOverviewDto = {
  posts: FeedPost[];
  materials: MaterialDto[];
  generations: AiGenerationDto[];
  palettes: PaletteDto[];
};

export async function getBookmarksOverview() {
  return apiFetch<BookmarksOverviewDto>('/bookmarks/overview/', { method: 'GET' });
}

export async function toggleGenerationBookmark(id: number) {
  return apiFetch<{ saved: boolean }>(`/creative/generations/${id}/bookmark/`, { method: 'POST', body: '{}' });
}

export async function togglePaletteBookmark(id: number) {
  return apiFetch<{ saved: boolean }>(`/creative/palettes/${id}/bookmark/`, { method: 'POST', body: '{}' });
}

export type AdminAiModelConfig = {
  model_name: string;
  updated_at: string;
};

export async function getAdminAiModelConfig() {
  return apiFetch<AdminAiModelConfig>('/admin/ai/model/', { method: 'GET' });
}

export async function updateAdminAiModelConfig(modelName: string) {
  return apiFetch<AdminAiModelConfig>('/admin/ai/model/', {
    method: 'PATCH',
    body: JSON.stringify({ model_name: modelName }),
  });
}

export type AdminOpenAiModelEntry = { id: string };

export type AdminOpenAiModelsResponse = {
  models: AdminOpenAiModelEntry[];
  cached: boolean;
  cache_ttl_sec: number;
  age_sec: number | null;
};

export async function listAdminOpenAiModels(refresh?: boolean) {
  const q = refresh ? '?refresh=1' : '';
  return apiFetch<AdminOpenAiModelsResponse>(`/admin/ai/models/${q}`, { method: 'GET' });
}

// ——— Челленджи ———

export type ChallengeCardDto = {
  id: number;
  title: string;
  description: string;
  cover_url: string | null;
  date_start: string | null;
  date_end: string | null;
  required_publications: number | null;
  duration_days: number | null;
  reward_title: string;
  is_published: boolean;
  /** Когда в последний раз опубликовали на сайте (ISO); у черновика — null */
  published_at: string | null;
  /** У текущего пользователя есть участие в этом испытании */
  i_participate: boolean;
};

export type ChallengeSlotDto = {
  id: number;
  day_number: number;
  slot_date: string | null;
  status: 'empty' | 'pending' | 'completed' | 'missed';
  post_id: number | null;
};

export type ChallengeParticipationDto = {
  participation_id: number;
  started_at: string;
  completed_at: string | null;
  reward_title: string | null;
  slots: ChallengeSlotDto[];
};

export type ChallengeDetailDto = ChallengeCardDto & {
  participation: ChallengeParticipationDto | null;
};

export async function getChallenges() {
  return apiFetch<ChallengeCardDto[]>('/challenges/', { method: 'GET' });
}

export async function getChallenge(id: number) {
  return apiFetch<ChallengeDetailDto>(`/challenges/${id}/`, { method: 'GET' });
}

export async function joinChallenge(id: number) {
  return apiFetch<ChallengeParticipationDto>(`/challenges/${id}/join/`, { method: 'POST', body: '{}' });
}

export async function refreshChallengeParticipation(id: number) {
  return apiFetch<ChallengeParticipationDto>(`/challenges/${id}/participation/`, { method: 'GET' });
}

export async function submitChallengePost(payload: {
  challengeDayId: number;
  title: string;
  description: string;
  tagIds: number[];
  images: File[];
}) {
  const fd = new FormData();
  fd.append('challenge_day_id', String(payload.challengeDayId));
  fd.append('title', payload.title);
  fd.append('description', payload.description);
  fd.append('tag_ids', JSON.stringify(payload.tagIds));
  for (const f of payload.images) {
    fd.append('images', f);
  }
  return apiFetch<FeedPost>('/posts/submit/', { method: 'POST', body: fd });
}

export async function adminListChallenges() {
  return apiFetch<ChallengeCardDto[]>('/admin/challenges/', { method: 'GET' });
}

export async function adminCreateChallenge(payload: FormData, opts?: { publishNow?: boolean }) {
  const fd = payload;
  if (opts?.publishNow) {
    fd.append('publish_now', '1');
  }
  return apiFetch<ChallengeCardDto>('/admin/challenges/', { method: 'POST', body: fd });
}

export async function adminPatchChallenge(id: number, payload: FormData) {
  return apiFetch<ChallengeCardDto>(`/admin/challenges/${id}/`, { method: 'PATCH', body: payload });
}

export async function adminPublishChallenge(id: number) {
  return apiFetch<ChallengeCardDto>(`/admin/challenges/${id}/publish/`, { method: 'POST', body: '{}' });
}

export async function adminUnpublishChallenge(id: number) {
  return apiFetch<ChallengeCardDto>(`/admin/challenges/${id}/unpublish/`, { method: 'POST', body: '{}' });
}

