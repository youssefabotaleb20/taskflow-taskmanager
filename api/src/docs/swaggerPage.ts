/** Swagger UI loaded from a CDN, so the API needs no static files (works on serverless hosts). */
const SWAGGER_VERSION = "5.17.14";
const CDN = `https://cdn.jsdelivr.net/npm/swagger-ui-dist@${SWAGGER_VERSION}`;

export const swaggerCsp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net`,
  `style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net`,
  "img-src 'self' data: https:",
  "connect-src 'self'",
].join("; ");

export const swaggerPage = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>TaskFlow API docs</title>
    <link rel="stylesheet" href="${CDN}/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="${CDN}/swagger-ui-bundle.js" crossorigin></script>
    <script>
      window.ui = SwaggerUIBundle({ url: "/docs/openapi.json", dom_id: "#swagger-ui", persistAuthorization: true });
    </script>
  </body>
</html>`;
