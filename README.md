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

La ruta `/` consulta un producto por SKU y permite registrar una venta. La aplicación usa las operaciones del SDL en `vendor/smartstock-infra/contracts/graphql/schema.graphql`, fijado al commit `6237ae7a047c3a16077db5bdd51a6ee89f5f90f1`. Inicializa el submódulo con `git submodule update --init --recursive`. El contrato todavía no define operaciones GraphQL de reposición, por lo que no se incluye esa funcionalidad.

```sh
npm ci
VITE_GRAPHQL_URL=http://localhost:4000/graphql npm run dev
```

Abre `http://localhost:5173/`. El ejemplo requiere un endpoint GraphQL que permita el origen de Vite mediante CORS. Para probar con el Gateway actual, usa Docker Compose de `smartstock-infra`, que publica `/graphql` en el mismo origen que la aplicación. La URL se incorpora durante la compilación de la imagen.

```sh
npm test
npm run build
docker build --build-arg VITE_GRAPHQL_URL=https://gateway.example/graphql -t smartstock-front .
docker run --rm -p 8080:80 smartstock-front
```

La imagen sirve `/` en `http://localhost:8080/`; configura una URL de Gateway accesible desde el navegador y CORS para ese origen. Fuera de localhost, usa HTTPS: la generación de identificadores mediante `crypto.randomUUID()` requiere un contexto seguro.

Antes de enviar, se guardan el identificador, SKU y cantidad en el almacenamiento local del navegador. Si la respuesta se pierde, se puede consultar o reintentar con los mismos datos, incluso tras recargar. No borres los datos del navegador mientras haya una venta sin resolver: no se sincronizan entre dispositivos ni perfiles. Una venta pendiente o incierta no debe considerarse rechazada; `sale: null` tampoco es una confirmación de ausencia definitiva. Los datos guardados solo se eliminan cuando el usuario inicia una venta nueva tras un resultado definitivo. Los guiones de prueba en `tests/browser-*.js` usan respuestas simuladas.
