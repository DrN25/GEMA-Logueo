- Cuidado con valores -1 y formulas, -1 equivale a vacio, osea que en sumatorias, u otras, no debe de considerarse, o ver la manera en que no altere a resultados
- TODOS deben estar con valores, caso contrario, si estan vacios o -1, contar como VACIOS, a EXCEPCION de aquellos que digan que si pueden ser vacios

# LGG:
- de:
    - Debe ser ≥ 0 (CRITICA)
    - Debe ser menor que "a:" del mismo registro (CRITICA)
    - Debe ser igual al "a:" del registro anterior (si es que existe) (CRITICA)

- a:
    - Debe ser ≥ 0 (CRITICA)
    - Debe ser > "de:" (CRITICA)

- Longitud Recuperada (m):
    - Debe ser ≥ 0 (CRITICA)
    - Debe ser ≤ ("a:" - "de:") (CRITICA)

- Σ Frag >10 cm (m):
    - Debe ser ≥ 0 (CRITICA)
    - Debe ser ≤ Longitud Recuperada (CRITICA)

- Longitud Roca Fracturada (m) (LRF): 
    - Debe ser ≥ 0 (CRITICA)
    - Debe ser ≤ Longitud Recuperada (CRITICA)

- FRF (Fracturas por metro):
    - Debe ser ≥ 0 (CRITICA)
    - Debe ser un numero entero (CRITICA)
    - Debe calcularse según la siguiente fórmula (CRITICA): 
        - Si LRF > 0: FRF = PISO( REDOND(LRF × 100) ÷ 5 ) + 1 
        - Si LRF = 0: FRF = 0

- N° de Frac. Naturales:
    - Debe ser ≥ 0 (CRITICA)
    - Debe ser un numero entero (CRITICA)

- LITOLOGIA (lito 1, lito 2,lito 3): misma logica que el sistema de mapeo (revisar si esta bien TODO LO RELACIONADO a esa parte en logueo. En mapeo esta correcto) (CRITICA)

- Resistencia Estimada (ISRM): 
    - Seguir valores de la tabla RESISTENCIA ESTIMADA (CRITICA)

- Tipo de Estructura 1 y Tipo de Estructura 2: 
    - Debe tener valores pertenecientes a tabla TIPOS DE ESTRUCTURA (CRITICA)
    - Puede reconocer un tipo J como si fuera JN (ADVERTENCIA)
    - Tipo de Estructura 2 PUEDE SER VACIO

- N° Frac. Nat. (Buz<30°):
    - Debe ser >= 0 (CRITICA)
    - Debe ser <= N° de Frac. Naturales (CRITICA)
    - Debe ser un numero entero (CRITICA)
    - La suma de los tres campos de fracturas por buzamiento debe ser ≈ N° de Frac. Naturales (ADVERTENCIA)

- N° Frac. Nat. (30°<Buz<60°):
    - Debe ser >= 0 (CRITICA)
    - Debe ser <= N° de Frac. Naturales (CRITICA)
    - Debe ser un numero entero (CRITICA)

- N° Frac. Nat. (Buz>60°):
    - Debe ser >= 0 (CRITICA)
    - Debe ser <= N° de Frac. Naturales (CRITICA)
    - Debe ser un numero entero (CRITICA)

- Abertura (mm.):
    - Debe ser >= 0 (CRITICA)

- Rugosidad (ISRM):
    - Debe tener valores pertenecientes a tabla PERFILES DE RUGOSIDAD TIPICOS (ISRM, 1989) (CRITICA)

- JRC10
    - Debe tener valores pertenecientes a tabla PERFILES DE RUGOSIDAD Y VALORES JRC10 (CRITICA)

- Grado Intemperismo (ISRM):
    - Debe tener valores pertenecientes a tabla INTEMPERISMO (ISRM) / METEORIZACION (CRITICA)

- Tipo Relleno 1 y Tipo Relleno 2:
    - Debe tener valores pertenecientes a tabla TIPO DE RELLENO Y VALORIZACION (CRITICA)
    - Tipo de Relleno 2 PUEDE SER VACIO

- Espesor Relleno (mm):
    - Debe ser >= 0 (CRITICA)
    - No puede ser mayor a Abertura (CRITICO). Las unicas excepciones son si el Tipo de Estructura 1 o 2 son: F, RF, VN, SZ, F+10, BED (en este caso no debe salir ninguna alerta)

- Presen. Agua (ISRM):
    - Debe tener valores pertenecientes a tabla PRESENCIA DE AGUA (ISRM) (CRITICA)

- Comentarios:
    - PUEDE SER VACIO

- Campaña:
    - Debe ser >= 0 (CRITICA)


# Logueo Estructural
- de: y a:
    - Debe ser >= 0 (CRITICA)
    - Debe ser un par existente exacto en algun registro del taladro actual en LGG (CRITICO)

- Profundidad (m):
    - Debe ser >= 0 (CRITICA)
    - El valor debe estar entre de: y a: (iguales a estos, o dentro) (CRITICA)

- LITOLOGIA (lito 1, lito 2,lito 3): misma logica que el sistema de mapeo (revisar si esta bien TODO LO RELACIONADO a esa parte en logueo. En mapeo esta correcto) (CRITICA)

- Tipo de Estructura: 
    - Debe tener valores pertenecientes a tabla TIPOS DE ESTRUCTURA (CRITICA)
    - Puede reconocer un tipo J como si fuera JN (ADVERTENCIA)

- Alpha (°):
    - Debe estar de 0° a 90° (CRITICA)
    - Debe ser un numero entero (ADVERTENCIA)

- Beta (°):
    - Debe estar de 0° a 360° (CRITICA)
    - Debe ser un numero entero (ADVERTENCIA)

- Dip (°):
    - Debe estar de 0° a 90° (CRITICA)

- Azimuth (°):
    - Debe estar de 0° a 360° (CRITICA)

- Forma:
    - Debe tener valores pertenecientes a tabla FORMA DE JUNTAS (CRITICA)

- Rugosidad (ISRM):
    - Debe tener valores pertenecientes a tabla PERFILES DE RUGOSIDAD TIPICOS (ISRM, 1989) (CRITICA)

- JRC10
    - Debe tener valores pertenecientes a tabla PERFILES DE RUGOSIDAD Y VALORES JRC10 (CRITICA)

- Abertura (mm):
    - Debe ser >= 0 (CRITICA)

- Grado Intemperismo:
    - Debe tener valores pertenecientes a tabla INTEMPERISMO (ISRM) / METEORIZACION (CRITICA)

- Espesor Relleno (mm):
    - Debe ser >= 0 (CRITICA)
    - No puede ser mayor a Abertura (CRITICO). Las unicas excepciones son si el Tipo de Estructura 1 o 2 son: F, RF, VN, SZ, F+10, BED (en este caso no debe salir ninguna alerta)

- Tipo Relleno 1 y Tipo Relleno 2:
    - Debe tener valores pertenecientes a tabla TIPO DE RELLENO Y VALORIZACION (CRITICA)
    - Tipo de Relleno 2 PUEDE SER VACIO

- Dureza de la pared de Estructura:
    - Debe tener valores pertenecientes a tabla RESISTENCIA ESTIMADA (CRITICA)

- Presen. Agua (ISRM):
    - Debe tener valores pertenecientes a tabla PRESENCIA DE AGUA (ISRM) (CRITICA)

- Comentarios:
    - PUEDE SER VACIO

- Campaña:
    - Debe ser >= 0 (CRITICA)


# TABLAS

- TABLA TIPOS DE ESTRUCTURA
| Tipo de Estructura          | Código   |
|-----------------------------|----------|
| Junta                       | JN       |
| Fallas < 10.0 cm            | F-10     |
| Zona de Cizalla             | SZ       |
| Estratos                    | BED      |
| Venas                       | VN       |
| Contacto                    | CON      |
| Sin estructuras             | SE       |
| Fallas > 10.0 cm            | F+10     |
| Sin información             | -1       |

- TABLA RESISTENCIA ESTIMADA
 | Clase | Descripción | Puntaje |
| :---: | :--- | :---: |
| R0 | Extremadamente débil | 0 |
| R1 | Muy débil | 1 |
| R2 | Débil | 2 |
| R3 | Media | 4 |
| R4 | Fuerte | 7 |
| R5 | Muy fuerte | 12 |
| R6 | Extremadamente fuerte | 15 |


- TABLA PERFILES DE RUGOSIDAD TIPICOS (ISRM, 1989)
| Clase | Descripción (Español) | Descripción (Inglés) |
| :---: | :--- | :--- |
| 1 | Rugosa y escalonada | Rough stepped |
| 2 | Suave y escalonada | Smooth stepped |
| 3 | Estriada y escalonada | Slickensided stepped |
| 4 | Rugosa y ondulada | Rough undulating |
| 5 | Suave y ondulada | Smooth undulating |
| 6 | Estriada y ondulada | Slickensided undulating |
| 7 | Rugosa y plana | Rough planar |
| 8 | Suave y plana | Smooth planar |
| 9 | Estriada y plana | Slickensided planar |

- TABLA PERFILES DE RUGOSIDAD Y VALORES JRC10
| Rango JRC10 |
| :---: |
| 0 - 2 |
| 2 - 4 |
| 4 - 6 |
| 6 - 8 |
| 8 - 10 |
| 10 - 12 |
| 12 - 14 |
| 14 - 16 |
| 16 - 18 |
| 18 - 20 |

- TABLA INTEMPERISMO (ISRM) / METEORIZACION
| Codigo | Valoración RMR76 | Valoración RMR89 | Grado de Meteorizacion (ISRM) |
| :---: | :---: | :---: | :--- |
| UWF | 5 | 6 | Fresca / Inalterada |
| SWD | 4 | 5 | Débilmente meteorizada |
| MWM | 3 | 3 | Moderadamente meteorizada |
| HWA | 1 | 1 | Altamente meteorizada |
| CWC | 0 | 0 | Completamente meteorizada |
| RS | 0 | 0 | Suelo Residual |
| -1 | -1 | -1 | Sin Información |

- TABLA TIPO DE RELLENO Y VALORIZACION
rmr 76
| Tipo de relleno 1 | Código | Clasificación | Sin Relleno | Relleno Duro < 5 mm | Relleno Duro > 5 mm | Relleno blando < 5 mm | Relleno blando > 5 mm |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Calcita | ca | 1 | | | | 2 | 0 |
| Arena | sand | 1 | | | | 2 | 0 |
| Clorita | ch | 1 | | | | 2 | 0 |
| Arcilla | cl | 1 | | | | 2 | 0 |
| Yeso | gy | 1 | | | | 2 | 0 |
| Roca triturada | RXF | 1 | | | | 2 | 0 |
| Brecha de falla | FBX | 2 | | 4 | 2 | | |
| Panizo | GOU | 1 | | | | 2 | 0 |
| Patinas | PAT | 1 | | | | 2 | 0 |
| Silicatos | SIO | 2 | | 4 | 2 | | |
| Cuarzo | QZ | 2 | | 4 | 2 | | |
| Sulfuros | SU | 2 | | 4 | 2 | | |
| Oxido de cobre | OX | 2 | | 4 | 2 | | |
| Epídota | ep | 2 | | 4 | 2 | | |
| Limpia, sin relleno | cwf | 3 | 5 | | | | |
| Sin información | -1 | | | | | | |
RMR 89
| Tipo de relleno 1 | Código | Clasificación | Sin Relleno | Relleno Duro < 5 mm | Relleno Duro > 5 mm | Relleno blando < 5 mm | Relleno blando > 5 mm |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Calcita | ca | 1 | | | | 2 | 0 |
| Arena | sand | 1 | | | | 2 | 0 |
| Clorita | ch | 1 | | | | 2 | 0 |
| Arcilla | cl | 1 | | | | 2 | 0 |
| Yeso | gy | 1 | | | | 2 | 0 |
| Roca triturada | RXF | 1 | | | | 2 | 0 |
| Brecha de falla | FBX | 2 | | 4 | 2 | | |
| Panizo | GOU | 1 | | | | 2 | 0 |
| Patinas | PAT | 1 | | | | 2 | 0 |
| Silicatos | SIO | 2 | | 4 | 2 | | |
| Cuarzo | QZ | 2 | | 4 | 2 | | |
| Sulfuros | SU | 2 | | 4 | 2 | | |
| Oxido de cobre | OX | 2 | | 4 | 2 | | |
| Epídota | ep | 2 | | 4 | 2 | | |
| Limpia, sin relleno | cwf | 3 | 6 | | | | |
| Sin información | -1 | | | | | | |

- TABLA PRESENCIA DE AGUA (ISRM)
| Codigo | Valoración RMR76 | Valoración RMR89 | Presencia de Agua (ISRM) |
| :---: | :---: | :---: | :--- |
| CDC | 10 | 15 | Completamente seco |
| DPH | 7 | 10 | Apenas Humedo |
| WTM | 7 | 7 | Mojado |
| DGE | 4 | 4 | Agua bajo presion moderada |
| FGF | 0 | 0 | Flujo continuo |

- TABLA FORMA DE JUNTAS
| Forma de Juntas | Puntuación |
| :--- | :---: |
| Plano | 1 |
| Curva | 2 |
| Ondulada | 3 |
| Escalonada | 4 |
| Ambos | 5 |
| Irregular | 6 |