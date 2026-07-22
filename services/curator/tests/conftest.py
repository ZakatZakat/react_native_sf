"""Make the curator `app` package importable when pytest is run from anywhere.

The curator service has no packaging metadata, so tests add its root
(services/curator) to sys.path rather than relying on an installed package.
"""

import sys
from pathlib import Path

CURATOR_ROOT = Path(__file__).resolve().parents[1]
if str(CURATOR_ROOT) not in sys.path:
    sys.path.insert(0, str(CURATOR_ROOT))
