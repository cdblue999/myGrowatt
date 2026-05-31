# -*- mode: python ; coding: utf-8 -*-

from PyInstaller.utils.hooks import collect_dynamic_libs
import os, PySide6

pyside_dir = os.path.dirname(PySide6.__file__)

# Collect PySide6 dynamic libs (Qt DLLs + shiboken)
pyside_bin = collect_dynamic_libs('PySide6')
shib_bin = collect_dynamic_libs('shiboken6')
# Also collect PySide6_Essentials / PySide6_Addons DLLs
ess_bin = collect_dynamic_libs('PySide6_Essentials')
add_bin = collect_dynamic_libs('PySide6_Addons')

# Qt platform plugin (required for window to open)
platform_datas = []
plugins_dir = os.path.join(pyside_dir, 'Qt', 'plugins')
for root, dirs, files in os.walk(plugins_dir):
    for f in files:
        src = os.path.join(root, f)
        rel = os.path.relpath(src, os.path.join(pyside_dir, 'Qt'))
        platform_datas.append((src, os.path.join('PySide6', 'Qt', rel)))

# Exclude Qt modules we don't need (most of them)
excludes = [
    'PySide6.Qt3D*', 'PySide6.QtBluetooth', 'PySide6.QtCharts',
    'PySide6.QtDataVisualization', 'PySide6.QtDesigner',
    'PySide6.QtGraphs*', 'PySide6.QtHelp', 'PySide6.QtHttpServer',
    'PySide6.QtLocation', 'PySide6.QtMultimedia*', 'PySide6.QtNfc',
    'PySide6.QtPdf*', 'PySide6.QtPositioning', 'PySide6.QtQml*',
    'PySide6.QtQuick*', 'PySide6.QtRemoteObjects', 'PySide6.QtScxml',
    'PySide6.QtSensors', 'PySide6.QtSerialBus', 'PySide6.QtSerialPort',
    'PySide6.QtSpatialAudio', 'PySide6.QtSql', 'PySide6.QtStateMachine',
    'PySide6.QtSvgWidgets', 'PySide6.QtTest', 'PySide6.QtTextToSpeech',
    'PySide6.QtUiTools', 'PySide6.QtWebChannel', 'PySide6.QtWebEngine*',
    'PySide6.QtWebSockets', 'PySide6.QtWebView', 'PySide6.QtXml',
    'PySide6.QtAxContainer', 'PySide6.QtCanvasPainter',
    'PySide6.scripts', 'PySide6.support',
]

a = Analysis(
    ['run_qt_app.py'],
    pathex=[],
    binaries=pyside_bin + shib_bin + ess_bin + add_bin,
    datas=platform_datas,
    hiddenimports=[
        'PySide6', 'shiboken6',
        'PySide6.QtCore', 'PySide6.QtGui', 'PySide6.QtWidgets',
        'PySide6.QtNetwork',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=excludes,
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='myGrowatt',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
