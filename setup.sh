#!/bin/bash
# koma 本地安装脚本 — 在 koma 目录下运行一次即可
set -e

echo "Installing dependencies..."
npm install

echo "Building..."
npm run build

echo "Registering global command..."
npm link

echo ""
echo "Done! You can now use 'koma' from anywhere:"
echo "  koma text \"你好\""
echo "  koma image \"a cute cat\" -o cat.png"
echo "  koma models"
