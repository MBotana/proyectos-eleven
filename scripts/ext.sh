#!/bin/sh
# Arma la extensión de Chrome: copia el lector (public/traer.js) y genera el .zip para la Chrome Web Store.
set -e
cd "$(dirname "$0")/.."
cp public/traer.js extension/traer.js
mkdir -p public/extension
rm -f public/extension/proyectos-eleven-extension.zip
(cd extension && zip -qr -X ../public/extension/proyectos-eleven-extension.zip . -x '.*')
echo "public/extension/proyectos-eleven-extension.zip"
