"""Legacy entrypoint -- delegates to seed_demo_data (single source of truth).

Use ``python seed_demo_data.py [--stats|--reset|--seed]`` directly.
"""

from seed_demo_data import seed_all


def seed():
    seed_all()


if __name__ == "__main__":
    seed()
