#!/bin/bash
# PDF 내보내기용 한글 폰트 다운로드
# Vercel 빌드 시 prebuild 단계에서 자동 실행

FONT_DIR="public/fonts"
FONT_FILE="$FONT_DIR/NotoSansKR.ttf"
FONT_URL="https://raw.githubusercontent.com/google/fonts/main/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf"

if [ -f "$FONT_FILE" ]; then
  echo "Font already exists: $FONT_FILE"
  exit 0
fi

mkdir -p "$FONT_DIR"
echo "Downloading NotoSansKR font..."
curl -L "$FONT_URL" -o "$FONT_FILE" --silent --show-error

if [ $? -eq 0 ] && [ -f "$FONT_FILE" ]; then
  echo "Font downloaded: $(du -h "$FONT_FILE" | cut -f1)"
else
  echo "Warning: Font download failed. PDF export will not work."
  exit 0
fi
