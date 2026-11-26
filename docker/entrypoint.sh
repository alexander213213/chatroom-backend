#!/bin/sh
set -e
# No JWT_SECRET given: make one once and keep it in the data volume, so logins survive restarts
if [ -z "$JWT_SECRET" ]; then
    secret_file="$CHATROOM_STORAGE_ROOT/.jwt_secret"
    [ -s "$secret_file" ] || head -c 32 /dev/urandom | base64 > "$secret_file"
    JWT_SECRET=$(cat "$secret_file")
    export JWT_SECRET
fi
exec java -jar /app/app.jar
