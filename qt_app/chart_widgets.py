from PySide6.QtWidgets import QWidget, QLabel, QVBoxLayout
from PySide6.QtCore import Qt, QRectF
from PySide6.QtGui import QPainter, QColor, QPen, QFont, QBrush, QPainterPath

DARK = '#0b0e14'
CARD = '#131820'
BORDER = '#232d3f'
TEXT = '#e8edf5'
DIM = '#8892a6'
ACCENT = '#f5c842'
GREEN = '#34d399'
BLUE = '#60a5fa'

class BarChart(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self._labels = []
        self._values = []
        self._title = ''
        self.setMinimumHeight(220)

    def set_data(self, labels, values, title=''):
        self._labels = labels
        self._values = values
        self._title = title
        self.update()

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        self._draw(painter)

    def _draw(self, p):
        w, h = self.width(), self.height()
        margin = 50
        bottom_margin = 30
        top_margin = 30

        if self._title:
            p.setPen(QColor(TEXT))
            f = QFont('Segoe UI', 11, QFont.Bold)
            p.setFont(f)
            p.drawText(QRectF(0, 0, w, 28), Qt.AlignCenter, self._title)

        chart_left = margin
        chart_right = w - 16
        chart_top = top_margin
        chart_bottom = h - bottom_margin
        chart_w = chart_right - chart_left
        chart_h = chart_bottom - chart_top

        if not self._values or max(self._values) == 0:
            p.setPen(QColor(DIM))
            f = QFont('Segoe UI', 10)
            p.setFont(f)
            p.drawText(QRectF(0, 0, w, h), Qt.AlignCenter, 'No data')
            return

        max_val = max(self._values) * 1.15
        n = len(self._values)
        if n == 0:
            return
        bar_w = min(40, chart_w / n * 0.6)
        gap = chart_w / n

        # grid
        p.setPen(QPen(QColor('#1e2838'), 1))
        for i in range(5):
            y = chart_top + chart_h * (1 - i / 4)
            p.drawLine(chart_left, y, chart_right, y)

        # bars
        for i, v in enumerate(self._values):
            x = chart_left + i * gap + (gap - bar_w) / 2
            bar_h = (v / max_val) * chart_h
            y = chart_bottom - bar_h

            rect = QRectF(x, y, bar_w, bar_h)
            path = QPainterPath()
            path.addRoundedRect(rect, 3, 3)

            color = QColor(ACCENT)
            color.setAlpha(200)
            p.fillPath(path, QBrush(color))

        # bottom labels
        p.setPen(QColor(DIM))
        f = QFont('Segoe UI', 7)
        p.setFont(f)
        step = max(1, n // 10)
        for i in range(0, n, step):
            x = chart_left + i * gap + gap / 2
            label = str(self._labels[i]) if self._labels else ''
            if len(label) > 6:
                label = label[:6]
            p.drawText(QRectF(x - 30, chart_bottom + 4, 60, 20),
                       Qt.AlignCenter, label)


class LineChart(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self._labels = []
        self._values = []
        self._title = ''
        self.setMinimumHeight(220)

    def set_data(self, labels, values, title=''):
        self._labels = labels
        self._values = values
        self._title = title
        self.update()

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        self._draw(painter)

    def _draw(self, p):
        w, h = self.width(), self.height()
        margin = 50
        bottom_margin = 30
        top_margin = 30

        if self._title:
            p.setPen(QColor(TEXT))
            f = QFont('Segoe UI', 11, QFont.Bold)
            p.setFont(f)
            p.drawText(QRectF(0, 0, w, 28), Qt.AlignCenter, self._title)

        chart_left = margin
        chart_right = w - 16
        chart_top = top_margin
        chart_bottom = h - bottom_margin
        chart_w = chart_right - chart_left
        chart_h = chart_bottom - chart_top

        if not self._values or max(self._values) == 0:
            p.setPen(QColor(DIM))
            f = QFont('Segoe UI', 10)
            p.setFont(f)
            p.drawText(QRectF(0, 0, w, h), Qt.AlignCenter, 'No data')
            return

        max_val = max(self._values) * 1.15
        n = len(self._values)
        if n < 2:
            return

        # grid
        p.setPen(QPen(QColor('#1e2838'), 1))
        for i in range(5):
            y = chart_top + chart_h * (1 - i / 4)
            p.drawLine(chart_left, y, chart_right, y)

        # line
        points = []
        for i, v in enumerate(self._values):
            x = chart_left + (i / (n - 1)) * chart_w
            y = chart_bottom - (v / max_val) * chart_h
            points.append((x, y))

        # fill
        if len(points) >= 2:
            path = QPainterPath()
            path.moveTo(points[0][0], chart_bottom)
            for px, py in points:
                path.lineTo(px, py)
            path.lineTo(points[-1][0], chart_bottom)
            path.closeSubpath()
            fill_color = QColor(BLUE)
            fill_color.setAlpha(30)
            p.fillPath(path, QBrush(fill_color))

        # stroke
        pen = QPen(QColor(BLUE), 2)
        p.setPen(pen)
        for i in range(1, len(points)):
            p.drawLine(points[i - 1][0], points[i - 1][1],
                       points[i][0], points[i][1])

        # points
        p.setBrush(QBrush(QColor(BLUE)))
        p.setPen(Qt.NoPen)
        for px, py in points:
            p.drawEllipse(px - 2, py - 2, 4, 4)

        # bottom labels
        p.setPen(QColor(DIM))
        f = QFont('Segoe UI', 7)
        p.setFont(f)
        step = max(1, n // 12)
        for i in range(0, n, step):
            x = chart_left + (i / (n - 1)) * chart_w
            label = str(self._labels[i]) if self._labels else ''
            if len(label) > 5:
                label = label[:5]
            p.drawText(QRectF(x - 30, chart_bottom + 4, 60, 20),
                       Qt.AlignCenter, label)
