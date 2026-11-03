from pathlib import Path
import zipfile
import json

root = Path(__file__).resolve().parent
version = json.loads((root / "system/system.json").read_text(encoding="utf-8"))["version"]
output = root / "releases" / f"vitruviy-{version}.zip"
output.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
    for path in sorted((root / "system").rglob("*")):
        if path.is_file():
            archive.write(path, Path("vitruviy") / path.relative_to(root / "system"))
    archive.write(root / "docs" / "INSTALL.md", "vitruviy/INSTALL.md")
print(output)

manifest_output = output.parent / "system.json"
manifest_output.write_text((root / "system/system.json").read_text(encoding="utf-8"), encoding="utf-8")
print(manifest_output)
