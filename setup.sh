#!/bin/bash
set -e

echo "=== Setting up Clifton Feedback ==="

echo ""
echo "--- Backend ---"
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
cd ..

echo ""
echo "--- Frontend ---"
cd frontend
npm install
cd ..

echo ""
echo "=== Done! ==="
echo ""
echo "To run:"
echo "  Terminal 1 (backend):  cd backend && npm run dev"
echo "  Terminal 2 (frontend): cd frontend && npm start"
echo ""
echo "Then open: http://localhost:4200"
