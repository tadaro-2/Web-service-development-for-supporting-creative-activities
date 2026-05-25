import os
import sys


def main() -> None:
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    from django.core.management import execute_from_command_line

    execute_from_command_line([sys.argv[0], "runserver", "0.0.0.0:8000", *sys.argv[1:]])


if __name__ == "__main__":
    main()
