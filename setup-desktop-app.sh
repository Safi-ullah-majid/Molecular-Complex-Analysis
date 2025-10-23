#!/bin/bash

echo "🧬 Setting up Molecular Complex Analyzer Desktop App"
echo "=================================================="

# Get current directory
APP_DIR="$(pwd)"

# Create launcher script
cat > "$APP_DIR/launch.sh" << 'LAUNCH'
#!/bin/bash
cd "$(dirname "$0")"

echo "Starting Molecular Complex Analyzer..."

# Start backend
python3 api.py &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Open in browser
xdg-open http://localhost:8000 2>/dev/null

# Cleanup on exit
trap "kill $BACKEND_PID 2>/dev/null; exit" INT TERM
wait $BACKEND_PID
LAUNCH

chmod +x "$APP_DIR/launch.sh"

# Create desktop entry
mkdir -p ~/.local/share/applications

cat > ~/.local/share/applications/molecular-analyzer.desktop << DESKTOP
[Desktop Entry]
Name=Molecular Complex Analyzer
Comment=Analyze molecular complexes using FairChem
Exec=$APP_DIR/launch.sh
Icon=$APP_DIR/icon.png
Terminal=false
Type=Application
Categories=Science;Education;Chemistry;
DESKTOP

# Update desktop database
update-desktop-database ~/.local/share/applications/ 2>/dev/null

echo ""
echo "✅ Setup complete!"
echo ""
echo "You can now:"
echo "  1. Run from terminal: ./launch.sh"
echo "  2. Search 'Molecular Complex Analyzer' in applications menu"
echo "  3. Add to favorites/dock"
echo ""
