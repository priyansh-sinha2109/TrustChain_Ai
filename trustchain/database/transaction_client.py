"""PostgREST-shaped client for reusing SupabaseRepository inside one SQL transaction.

This is deliberately a small bridge for its existing get/post calls, not another schema
or procurement repository. Every value is bound; identifiers use psycopg.sql.Identifier.
The owning adapter supplies the connection and commits/rolls back the whole operation.
"""
import json

from psycopg import sql
from psycopg.types.json import Jsonb

from .client import SupabaseRestClient


class TransactionClient(SupabaseRestClient):
    def __init__(self, connection, config):
        super().__init__(config)
        self.connection = connection

    def post(self, table, payload, use_service_key=True):
        statement = sql.SQL("INSERT INTO public.{} ({}) VALUES ({}) RETURNING *").format(
            sql.Identifier(table), sql.SQL(",").join(map(sql.Identifier, payload)),
            sql.SQL(",").join(sql.Placeholder() for _ in payload))
        values = [Jsonb(value) if isinstance(value, (dict, list)) else value for value in payload.values()]
        row = self.connection.execute(statement, values).fetchone()
        return json.loads(json.dumps(row, default=str))

    def get(self, table, query_params=None, use_service_key=True):
        statement = sql.SQL("SELECT * FROM public.{}").format(sql.Identifier(table))
        conditions, values = [], []
        params = query_params or {}
        for key, value in params.items():
            if key in {"order", "limit"}:
                continue
            if not value.startswith("eq."):
                raise ValueError("Only equality filters are supported by the transaction bridge.")
            conditions.append(sql.SQL("{} = %s").format(sql.Identifier(key)))
            values.append(value[3:])
        if conditions:
            statement += sql.SQL(" WHERE ") + sql.SQL(" AND ").join(conditions)
        if "order" in params:
            column, direction = params["order"].split(".")
            if direction not in {"asc", "desc"}:
                raise ValueError("Invalid ordering")
            statement += sql.SQL(" ORDER BY {} {}").format(sql.Identifier(column), sql.SQL(direction))
        if "limit" in params:
            statement += sql.SQL(" LIMIT %s")
            values.append(int(params["limit"]))
        rows = self.connection.execute(statement, values).fetchall()
        return json.loads(json.dumps(rows, default=str))
