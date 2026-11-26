# SmartStock · Frontend

Aplicación web de SmartStock desde la que el operador consulta existencias, registra ventas y recupera su estado.

**Stack** · React, TypeScript y Vite.

## Funcionalidades

- **Inventario.** Consultar los SKU, su saldo disponible y las alertas asociadas al umbral de reposición.
- **Ventas.** Registrar las unidades vendidas y consultar su estado por identificador.
- **Seguimiento.** Mostrar si una operación está en curso, se completó o requiere corregir un error.

## Integración

La aplicación consulta existencias y registra ventas mediante la API GraphQL de `smartstock-gateway`. El entorno Docker Compose de `smartstock-infra` sirve la aplicación y GraphQL en el mismo origen. Las operaciones de Compras están disponibles en la API interna de Gateway y su interfaz web queda pendiente.

## Desarrollo

Este repositorio mantiene la aplicación web, sus componentes y las operaciones GraphQL que consume. Para trabajar contra el sistema integrado, el frontend necesita acceso a la URL GraphQL del Gateway. El entorno conjunto se documenta en `smartstock-infra`.

### Primer corte

El Dashboard es la entrada. La navegación da acceso a Inventario, Ventas, Compras y Reposición IA. El Gateway actual permite consultar existencias por SKU, registrar ventas y consultar su estado mediante el ID de venta. El Dashboard y las tablas reales muestran las consultas y confirmaciones observadas en la sesión.

El enlace **Abrir demo** carga el escenario de ejemplo (`/?modo=demo`). Ahí se puede simular una venta, analizar la reposición, crear y aprobar una orden y registrar su recepción. **Reiniciar demo** vuelve al punto anterior a la venta. El escenario se guarda por pestaña y sus acciones modifican únicamente datos de ejemplo.

La aplicación usa el SDL de `vendor/smartstock-infra/contracts/graphql/schema.graphql`, fijado al commit `6237ae7a047c3a16077db5bdd51a6ee89f5f90f1`. Inicializa el submódulo con `git submodule update --init --recursive`.

```sh
(cd ../smartstock-infra && docker compose up --build -d gateway)
npm ci
npm run dev
```

Abre `http://127.0.0.1:5173/`. Vite sirve la aplicación y reenvía `/graphql` al Gateway en `127.0.0.1:3001`. Si cambias el puerto del Gateway, define `GATEWAY_HTTP_PORT` con el mismo valor al ejecutar Compose y Vite. Tras arrancar los servicios, consulta `SKU-001` para comprobar la conexión.

Con Docker Compose completo, Nginx sirve la aplicación y GraphQL en el mismo origen. Para usar un endpoint externo, define `VITE_GRAPHQL_URL` al iniciar Vite o al compilar la imagen y configura CORS en ese servidor si el navegador accede desde otro origen.

```sh
npm test
npm run build
docker build --build-arg VITE_GRAPHQL_URL=https://gateway.example/graphql -t smartstock-front .
docker run --rm -p 8080:80 smartstock-front
```

La imagen sirve `/` en `http://localhost:8080/`; configura una URL de Gateway accesible desde el navegador y CORS para ese origen. Fuera de localhost, usa HTTPS: la generación de identificadores mediante `crypto.randomUUID()` requiere un contexto seguro.

Antes de enviar, se guardan el identificador, SKU y cantidad en el almacenamiento local del navegador. Si la respuesta se pierde, se puede consultar o reintentar con los mismos datos, incluso tras recargar. No borres los datos del navegador mientras haya una venta sin resolver: no se sincronizan entre dispositivos ni perfiles. Una venta pendiente o incierta no debe considerarse rechazada; `sale: null` tampoco es una confirmación de ausencia definitiva. Los datos guardados solo se eliminan cuando el usuario inicia una venta nueva tras un resultado definitivo. Los guiones de prueba en `tests/browser-*.js` usan respuestas simuladas.
