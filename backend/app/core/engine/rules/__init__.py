"""
app.core.engine.rules
Inicializador y registro de reglas del motor de auditoría geomecánica.
"""

from app.core.engine.registry import default_registry

from app.core.engine.rules.lgg_rules import (
    LGG_MandatoryFieldsRule,
    LGG_CatalogsAndFormatsRule,
    LGG_PhysicalAndGeometricRule,
    LGG_FracturesAndFRFRule,
    LGG_GeomechanicalCompatibilityRule,
)
from app.core.engine.rules.est_rules import (
    Estructural_MandatoryFieldsRule,
    Estructural_GeometryAndAnglesRule,
    Estructural_SpatialContainmentRule,
    Estructural_CrossCheckWithLGGRule,
)
# Alias para compatibilidad hacia atrás
Estructural_GeometryAndCompatibilityRule = Estructural_GeometryAndAnglesRule

from app.core.engine.rules.rmr_rules import (
    RMR_MandatoryFieldsRule,
    RMR_CrossCheckWithLGGRule,
    RMR_FormulasAndRatingsRule,
)
from app.core.engine.rules.eoh_rules import (
    CrossModule_EOHRule,
)
from app.core.engine.rules.heavy_rules import (
    DependentFieldsIncompleteRule,
    ContinuousCrushedZoneAnomalyRule,
    AbruptCompetenceDropRule,
)


def register_all_rules(registry=default_registry):
    """Registra todas las reglas modulares en el catálogo de ejecución."""
    # LGG
    registry.register(LGG_MandatoryFieldsRule)
    registry.register(LGG_CatalogsAndFormatsRule)
    registry.register(LGG_PhysicalAndGeometricRule)
    registry.register(LGG_FracturesAndFRFRule)
    registry.register(LGG_GeomechanicalCompatibilityRule)

    # Estructural
    registry.register(Estructural_MandatoryFieldsRule)
    registry.register(Estructural_GeometryAndAnglesRule)
    registry.register(Estructural_SpatialContainmentRule)
    registry.register(Estructural_CrossCheckWithLGGRule)

    # Validación RMR
    registry.register(RMR_MandatoryFieldsRule)
    registry.register(RMR_CrossCheckWithLGGRule)
    registry.register(RMR_FormulasAndRatingsRule)

    # EOH
    registry.register(CrossModule_EOHRule)

    # Reglas Avanzadas y de Lógica Pesada
    registry.register(DependentFieldsIncompleteRule)
    registry.register(ContinuousCrushedZoneAnomalyRule)
    registry.register(AbruptCompetenceDropRule)


# Auto-registro al importar el módulo
register_all_rules(default_registry)
