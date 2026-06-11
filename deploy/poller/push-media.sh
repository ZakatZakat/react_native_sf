#!/bin/sh
# Пушим media из tmpfs поллера на общий сервер и удаляем у себя.
# Имена файлов детерминированы (по message-id) → повторный пуш идемпотентен,
# поэтому гонка "удалили до пуша" самоисцеляется на следующем цикле.
CID=poller-telegram-1
N=$(docker exec $CID sh -c 'find /app/media -type f 2>/dev/null | wc -l')
[ "$N" -eq 0 ] && exit 0
docker exec $CID sh -c 'cd /app/media && find . -type f | tar -cf - -T -' 2>/dev/null \
  | ssh -o ConnectTimeout=15 -o StrictHostKeyChecking=no root@45.144.52.40 \
      "docker run --rm -i -v react_native_sf_citysignal_media:/m alpine tar xf - -C /m" \
  && docker exec $CID sh -c 'find /app/media -type f -delete'
echo "pushed $N files"
