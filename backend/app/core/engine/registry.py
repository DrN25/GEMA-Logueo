"""
app.core.engine.registry
Registro y catálogo dinámico de reglas geomecánicas.
"""

from typing import List, Dict, Type, Union
from app.core.engine.base_rule import BaseRule


class RuleRegistry:
    """Administra el registro, descubrimiento y orden de ejecución de reglas."""

    def __init__(self):
        self._rules: List[BaseRule] = []
        self._rules_by_code: Dict[str, BaseRule] = {}

    def register(self, rule_or_cls: Union[BaseRule, Type[BaseRule]]) -> BaseRule:
        """Registra una instancia o clase de regla."""
        rule_instance = rule_or_cls() if isinstance(rule_or_cls, type) else rule_or_cls
        code = getattr(rule_instance, "code", None)
        if not code:
            raise ValueError(f"La regla {rule_instance} no tiene un atributo 'code' definido.")
        
        if code in self._rules_by_code:
            # Reemplazar o actualizar regla existente
            idx = next(i for i, r in enumerate(self._rules) if r.code == code)
            self._rules[idx] = rule_instance
        else:
            self._rules.append(rule_instance)
        
        self._rules_by_code[code] = rule_instance
        return rule_instance

    def get_all(self) -> List[BaseRule]:
        return list(self._rules)

    def get_by_group(self, group: str) -> List[BaseRule]:
        return [r for r in self._rules if r.group.upper() == group.upper()]

    def get_by_code(self, code: str) -> BaseRule:
        return self._rules_by_code.get(code)

    def clear(self):
        self._rules.clear()
        self._rules_by_code.clear()


# Registro global por defecto
default_registry = RuleRegistry()
