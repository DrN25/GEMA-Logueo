COMO RELACIONAR VALIDACION RMR CON LGG
- Corrida: Funciona como el id de a que fila de LGG nos estamos refiriendo. En Validacion RMR, el numero de corrida es como el numero de fila que corresponde a cada fila por cada taladro. LGG no tiene este valor, pero se puede deducir por el numero de fila respecto a ese taladro.


- Vacios: Ninguna De las columnas mencionadas puede estar vacio, osea sin valor, o -1.
- Campos negativos [CRITICA]: Ninguno de los campos puede ser negativo (a excepcion de -1 que ya mencionamos que significa)
- Corrida [CRITICA]: El numero total de filas o corridas que tiene en total un taladro en VALIDACION RMR, debe de ser la misma cantidad que la cantidad de filas o corridas que tiene en total un taladro en LGG
- Lito 1,2,3 [CRITICA]: Combinacion litologica Entre lito 1 2 3 debe tener la misma combinacion litologica de LGG para esa corrida
- Desde (m) Hasta (m) [CRITICA]: Rango desde hasta debe tener el mismo rango de LGG para esa corrida
- Long. Corrida (m) [CRITICA]: Debe ser <Hasta (m) - Desde(m)> Redondeado a 2 (tolerancia 0.1)
- Long. Corrida (m) [CRITICA]: Debe ser mayor a 0
- Rec (m) [CRITICA]: Debe ser igual a "Longitud Recuperada (m)" de LGG
- Rec (%) [CRITICA]: Debe ser <Rec(m) / Long. Corrida (m)> Redondeado a entero
- RQD (m) [CRITICA]: Debe ser igual a "(RQD) ∑ Frag's ≥ 10 cm (m)" de LGG
- RQD (%) [CRITICA]: Debe ser <RQD (m) / Long. Corrida (m)> Redondeado a entero
- Long. Tramo Fracturado (m) [CRITICA]: Debe ser igual a "Longitud Roca Fracturada (m)" de LGG
- FRF (zonas trituradas) [CRITICA]: Debe ser igual a "FRF" de LGG
- Fracturas Naturales [CRITICA]: Debe ser igual a "N° de Frac. Naturales" de LGG
- Total de Fracturas [CRITICA]: Debe ser <FRF (zonas trituradas) + Fracturas Naturales> Redondeado a entero
- FF/1m [CRITICA]: Debe ser <Total de Fracturas / Long. Corrida (m)> Redondeado a entero
- Espaciamiento (mm) [CRITICA]: Debe ser <Long. Corrida (m) / Total de Fracturas> Redondeado a entero; o si Total de FracturasRedondeado es 0, entonces debe ser <Long. Corrida (m)> 
- Resistencia [CRITICA]: De ser igual a "Resist. Máx. Estimada (ISRM)" de LGG
- Tipo de Estructura [CRITICA]: Debe ser igual a "Tipo de estruct." de LGG
- Abertura (mm) [CRITICA]: Debe ser igual a "Abertura (mm.)" de LGG
- Rugosidad [CRITICA]: Debe ser igual a "Rugosidad (ISRM)" de LGG
- Relleno [CRITICA]: Debe ser igual a "Tipo de Relleno 1" de LGG
- Clasificación Relleno [CRITICA]: Debe de corresponder a los valores de la tabla TIPO DE RELLENO Y VALORES, especificamente al valor de Clasificacion que le corresponde al Codigo
- Intemperismo [CRITICA]: Debe ser igual a "Grado Intemp. (ISRM)" de LGG
- JRC10 [CRITICA]: Debe ser igual a "JRC10" de LGG
- Espesor de relleno [CRITICA]: Deber ser igual a "Espesor Relleno (mm)" de LGG
- Presencia de Agua [CRITICA]: Validacion pendiente. Colocar comentario, ya que si existe, pero esta pendiente

*Desde aqui, las columnas se repiten, pero la primera aparicion corresponde a calculos de 76 y la segunda aparicion a calculos del 89*

- Resistencia [CRITICA]: Segun su "Resistencia", asignar su Rating o Puntaje correspondiente segun la tabla de RESISTENCIA UNIAXIAL (ver catalogo del sistema en PARAMETROS RMR)
- RQD [CRITICA]: Segun su "RQD (%)" se halla asi: -0.000006 * (RQD)^3 + 0.0015 * (RQD)^2 + 0.0806 * (RQD) + 3.0282. Redondeo a entero
- Espaciamiento [CRITICA]: Segun su "Espaciamiento (mm)" se halla asi: 6.038 * LN(T2) - 19.63  (Mínimo: 5 | Máximo: 30). Redondeo a entero
- Abertura (mm) [CRITICA]: Segun su "Abertura (mm)". asignar su Rating del 76 o 89 correspondiente segun al tabla de ABERTURA (ver catalogo del sistema en PARAMETROS RMR)
- Rugosidad (mm) [CRITICA]: Segun su "Rugosidad". asignar su Rating del 76 o 89 segun la tabla de RUGOSIDAD, especificamente al Valor del 76 o 89 correspondientes al Codigo que es la Rugosidad
- Relleno [CRITICA]: Segun su "Clasificacion de Relleno" (1 = Blando, 2 = Duro, 3 = Sin Relleno) y "Espesor de relleno", asignar su rating del 76 o 89 segun la tabla de VALORACION DE RELLANO
- Intemperismo [CRITICA]: Segun su "Intemperismo", asignar su rating del 76 o 89 segun la tabla de METEORIAZION E INTEMPERISMO (ISRM) (ver catalogo del sistema en la seccion PARAMETROS RMR)
- Persistencia [CRITICA]: Promedio entre: <Abertura, Rugosidad, Relleno, Intemperismo>, redondeado a entero
- Condición de Juntas [CRITICA]: Suma entre: <Abertura, Rugosidad, Relleno, Intemperismo, Persistencia>, redondeado a entero
- Presencia de Agua [CRITICA]: Segun su "Presencia de Agua", asignar su rating del 76 o 89 segun la tabla de PRESENCIA DE AGUA SUBTERRANEA (ver catalogo del sistema en la seccion PARAMETROS RMR)
- RMR'76 / RMR'89 [CRITICA]: Suma entre: <Resistencia, RQD, Espaciamiento, Condicion de Juntas, Presencia de Agua>, redondeado a entero
- RMR'76 / RMR'89 [CRITICA]: Debe de estar entre el rango de 0 a 100
- CALIDAD DE LA ROCA [CRITICA]: Segun su RMR, asignar su rating del 76 o 89 segun la tabla de CLASIFICACION FINAL DE MACIZOS ROCOSOS (BIENIAWSKI) (ver catalogo del sistema en la seccion PARAMETROS RMR)
- Litología [ALERTA]: Debe ser igual a "Lito 1"

TABLA VALORACION DE RELLENO
| RMR_76 | RMR_89 | Descripción |
| :---: | :---: | :--- |
| 5 | 6 | Sin relleno (Ninguno) |
| 4 | 4 | Relleno duro < 5 mm |
| 2 | 2 | Relleno duro > 5 mm |
| 2 | 2 | Relleno blando < 5 mm |
| 0 | 0 | Relleno blando > 5 mm |


TABLA TIPO DE RELLENO Y VALORES
### RMR_76

| Tipo de Relleno | Codigo | Clasificación | Sin Relleno | Relleno Duro < 5 mm | Relleno Duro > 5 mm | Relleno blando < 5 mm | Relleno blando > 5 mm |
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

### RMR_89

| Tipo de Relleno | Codigo | Clasificación | Sin Relleno | Relleno Duro < 5 mm | Relleno Duro > 5 mm | Relleno blando < 5 mm | Relleno blando > 5 mm |
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


TABLA DE RUGOSIDAD
| Roughness & Shape (ISRM) | Código | Val_RMR76 | Val_RMR89 |
| :--- | :---: | :---: | :---: |
| Rugosa y Escalonada | 1 | 5 | 6 |
| Suave y Escalonada | 2 | 4 | 5 |
| Estriada y Escalonada | 3 | 3 | 3 |
| Rugosa y Ondulada | 4 | 4 | 5 |
| suave y Ondulada | 5 | 3 | 3 |
| Estriada y Ondulada | 6 | 1 | 1 |
| Rugosa y Plana | 7 | 3 | 3 |
| Suave y Plana | 8 | 1 | 1 |
| Estriada y Plana | 9 | 0 | 0 |
| Sin Información | -1 | 0 | 0 |