"""Alembic environment. Migrations run as the database owner; the URL is supplied by the caller."""
from alembic import context
from sqlalchemy import create_engine

url = context.config.get_main_option("sqlalchemy.url")
assert url is not None, "sqlalchemy.url must be set (see buyers_desk.provision)"

engine = create_engine(url)
with engine.connect() as connection:
    context.configure(connection=connection)
    with context.begin_transaction():
        context.run_migrations()
engine.dispose()
