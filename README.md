# SmartStock · Frontend

Aplicación web de SmartStock desde la que el operador consulta existencias, registra ventas y revisa reposiciones. Presenta los datos de los distintos servicios en una interfaz común.

**Stack** · React, TypeScript, Next.js, Apollo Client y Tailwind CSS.

## Funcionalidades

- **Inventario.** Consultar los SKU, su saldo disponible y las alertas asociadas al umbral de reposición.
- **Ventas.** Registrar las unidades vendidas y consultar el resultado o el historial disponible.
- **Reposición.** Iniciar un análisis, revisar el proveedor y la cantidad propuestos, consultar la justificación del agente y aprobar o rechazar el borrador.
- **Seguimiento.** Mostrar si una operación está en curso, se completó o requiere corregir un error.

## Integración

La aplicación lee y modifica datos mediante la API GraphQL de `smartstock-gateway`. Para las solicitudes que el Gateway envía a Compras por Kafka, la interfaz muestra el estado pendiente hasta que esté disponible el resultado. Las reglas de stock, ventas y aprobación pertenecen a los servicios que reciben cada operación.

## Desarrollo

Este repositorio mantiene la aplicación web, sus componentes y las operaciones GraphQL que consume. Para trabajar contra el sistema integrado, el frontend necesita acceso a la URL GraphQL del Gateway. El entorno conjunto se documenta en `smartstock-infra`.
