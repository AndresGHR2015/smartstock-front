# SmartStock · Frontend

Interfaz de SmartStock para registrar una venta, ver el stock resultante y revisar la orden de reposición propuesta por la IA.

**Stack** · React, TypeScript, Next.js, Apollo Client y Tailwind CSS.

## Alcance del MVP

La primera versión reúne el flujo en una pantalla para un SKU precargado:

1. Mostrar el stock y permitir registrar una venta.
2. Mostrar la alerta si el saldo alcanza el umbral de reposición.
3. Permitir iniciar el análisis y mostrar el proveedor, la cantidad y la justificación del borrador generado.
4. Permitir aprobar el borrador y reflejar el estado de la orden.

## Integración

La interfaz consume la API GraphQL de `smartstock-gateway`. Los estados de carga, error y procesamiento pendiente deben verse en la pantalla para que el operador sepa si la venta o la compra se completó.

## Primera verificación

Registrar una venta desde la interfaz y comprobar que el saldo mostrado coincide con la respuesta del Gateway.
