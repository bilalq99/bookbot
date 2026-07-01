"""Enable ``python -m mental_health``."""

import sys

from .cli import main

if __name__ == "__main__":
    sys.exit(main())
