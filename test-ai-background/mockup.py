"""
Ports the exact mockup chrome from web/src/components/LockScreenCard.tsx
(status bar, big clock, date, Now Playing widget, flashlight/camera,
home indicator) to PIL, so test wallpapers can be previewed the same way
the website shows them — not just the bare background.

All proportions below are the *same* cqw (% of canvas width) values used
in LockScreenCard.tsx, converted to pixels for W=1284.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

TEST_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = TEST_DIR.parent
LORA_REGULAR = PROJECT_ROOT / "scripts" / "fonts" / "Lora-Regular.ttf"
OSWALD = TEST_DIR / "fonts" / "Oswald-Medium.ttf"

W = 1284  # cqw is a % of this


def cqw(v):
    return v / 100 * W


def hex_to_rgba(hex_str, alpha=255):
    hex_str = hex_str.lstrip("#")
    r, g, b = (int(hex_str[i:i + 2], 16) for i in (0, 2, 4))
    return (r, g, b, alpha)


def load_oswald(size):
    font = ImageFont.truetype(str(OSWALD), size)
    try:
        font.set_variation_by_name("Medium")
    except Exception:
        pass
    return font


def rounded_rect_layer(size, box, radius, fill_rgba):
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle(box, radius=radius, fill=fill_rgba)
    return layer


def circle_layer(size, center, r, fill_rgba):
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse([center[0] - r, center[1] - r, center[0] + r, center[1] + r], fill=fill_rgba)
    return layer


def signal_icon(draw, x, y, w, color):
    h = w * 12 / 18
    bar_w = w / 18 * 3
    heights = [5, 7, 9, 12]
    bottoms_from = [7, 5, 3, 0]
    for i, (bh, by) in enumerate(zip(heights, bottoms_from)):
        bx = x + i * (bar_w + w / 18 * 2)
        scaled_h = bh / 12 * h
        scaled_y = y + (by / 12 * h)
        draw.rounded_rectangle([bx, scaled_y, bx + bar_w, y + h], radius=1, fill=color)


def battery_icon(draw, x, y, w, color):
    h = w * 12 / 25
    draw.rounded_rectangle([x, y, x + w * 21 / 25, y + h], radius=h * 0.22, outline=color, width=max(1, int(w * 0.02)))
    pad = w * 0.06
    draw.rounded_rectangle([x + pad, y + pad, x + w * 18 / 25, y + h - pad], radius=h * 0.15, fill=color)
    nub_w = w * 2 / 25
    draw.rounded_rectangle([x + w * 22.5 / 25, y + h * 0.33, x + w * 22.5 / 25 + nub_w, y + h * 0.67], radius=nub_w / 2, fill=color)


def draw_prev_icon(draw, x, y, size, color):
    h = size
    bar_w = size * 0.18
    draw.rectangle([x, y, x + bar_w, y + h], fill=color)
    draw.polygon([(x + bar_w + size * 0.05, y + h / 2), (x + size, y), (x + size, y + h)], fill=color)


def draw_next_icon(draw, x, y, size, color):
    h = size
    bar_w = size * 0.18
    draw.rectangle([x + size - bar_w, y, x + size, y + h], fill=color)
    draw.polygon([(x, y), (x + size - bar_w - size * 0.05, y + h / 2), (x, y + h)], fill=color)


def draw_pause_icon(draw, x, y, size, color):
    bar_w = size * 0.25
    gap = size * 0.16
    draw.rounded_rectangle([x, y, x + bar_w, y + size], radius=bar_w * 0.2, fill=color)
    draw.rounded_rectangle([x + bar_w + gap, y, x + 2 * bar_w + gap, y + size], radius=bar_w * 0.2, fill=color)


def draw_speaker_icon(draw, x, y, size, color):
    h = size
    draw.polygon([
        (x, y + h * 0.35), (x + h * 0.3, y + h * 0.35), (x + h * 0.55, y + h * 0.1),
        (x + h * 0.55, y + h * 0.9), (x + h * 0.3, y + h * 0.65), (x, y + h * 0.65),
    ], fill=color)
    draw.arc([x + h * 0.55, y + h * 0.15, x + h * 1.15, y + h * 0.85], start=-55, end=55, fill=color, width=max(1, int(size * 0.09)))


def draw_flashlight_icon(draw, cx, cy, size, color):
    w = size * 0.5
    h = size * 0.85
    x0, y0 = cx - w / 2, cy - h / 2
    draw.rounded_rectangle([x0 + w * 0.15, y0, x0 + w * 0.85, y0 + h * 0.15], radius=w * 0.05, outline=color, width=max(2, int(size * 0.06)))
    draw.rectangle([x0 + w * 0.2, y0 + h * 0.15, x0 + w * 0.8, y0 + h * 0.85], outline=color, width=max(2, int(size * 0.06)))


def draw_camera_icon(draw, cx, cy, size, color):
    w = size * 0.75
    h = size * 0.6
    x0, y0 = cx - w / 2, cy - h / 2 + size * 0.05
    draw.rounded_rectangle([x0, y0, x0 + w, y0 + h], radius=w * 0.12, outline=color, width=max(2, int(size * 0.07)))
    r = h * 0.32
    draw.ellipse([cx - r, cy + size * 0.05 - r, cx + r, cy + size * 0.05 + r], outline=color, width=max(2, int(size * 0.07)))


def truncate_text(draw, text, font, max_width):
    """Mirrors CSS text-overflow: ellipsis — shortens text to fit max_width,
    appending a single ellipsis character, instead of overflowing the card."""
    if draw.textlength(text, font=font) <= max_width:
        return text
    lo, hi = 0, len(text)
    while lo < hi:
        mid = (lo + hi + 1) // 2
        candidate = text[:mid].rstrip() + "…"
        if draw.textlength(candidate, font=font) <= max_width:
            lo = mid
        else:
            hi = mid - 1
    return text[:lo].rstrip() + "…"


def apply_mockup_chrome(img, caption, text_color_hex):
    """img: 1284x2778 RGB base wallpaper. Returns a new RGB image with the
    full lock-screen mockup overlay drawn on top (status bar, clock, date,
    Now Playing widget, flashlight/camera, home indicator)."""
    base = img.convert("RGBA")
    H = base.height
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    text_rgba = hex_to_rgba(text_color_hex)

    # --- status bar ---
    sb_y = cqw(5.2)
    sb_right = W - cqw(6.3)
    batt_w = cqw(6.5)
    batt_x = sb_right - batt_w
    battery_icon(draw, batt_x, sb_y, batt_w, text_rgba)
    font_5g = ImageFont.truetype(str(LORA_REGULAR), int(cqw(3.4)))
    g5_w = draw.textlength("5G", font=font_5g)
    g5_x = batt_x - cqw(1.6) - g5_w
    draw.text((g5_x, sb_y - cqw(0.3)), "5G", font=font_5g, fill=text_rgba)
    sig_w = cqw(4.7)
    sig_x = g5_x - cqw(1.6) - sig_w
    signal_icon(draw, sig_x, sb_y, sig_w, text_rgba)

    # --- date + time ---
    dt_top = cqw(14.6)
    font_date = ImageFont.truetype(str(LORA_REGULAR), int(cqw(4.2)))
    date_text = "Thursday, August 6"
    date_w = draw.textlength(date_text, font=font_date)
    draw.text(((W - date_w) / 2, dt_top), date_text, font=font_date, fill=(*text_rgba[:3], 230))

    time_size = int(cqw(54))
    font_time = load_oswald(time_size)
    time_text = "9:41"
    bbox = draw.textbbox((0, 0), time_text, font=font_time)
    time_w = bbox[2] - bbox[0]
    time_y = dt_top + cqw(4.2) * 1.3
    draw.text(((W - time_w) / 2 - bbox[0], time_y), time_text, font=font_time, fill=text_rgba)

    # --- Now Playing widget ---
    widget_x0 = cqw(6.3)
    widget_x1 = W - cqw(6.3)
    widget_h = cqw(41)  # approximate total widget height (padding + rows)
    widget_y1 = H - cqw(25)
    widget_y0 = widget_y1 - widget_h
    radius = cqw(9.5)
    widget_layer = rounded_rect_layer(base.size, [widget_x0, widget_y0, widget_x1, widget_y1], radius, (255, 255, 255, 230))
    overlay = Image.alpha_composite(overlay, widget_layer)
    draw = ImageDraw.Draw(overlay)

    pad = cqw(4.4)
    art_size = cqw(15)
    art_x, art_y = widget_x0 + pad, widget_y0 + pad
    art = img.convert("RGB").resize((int(art_size), int(art_size)), Image.LANCZOS)
    art_mask = Image.new("L", art.size, 0)
    ImageDraw.Draw(art_mask).rounded_rectangle([0, 0, art.size[0], art.size[1]], radius=cqw(3.4), fill=255)
    overlay.paste(art, (int(art_x), int(art_y)), art_mask)
    draw = ImageDraw.Draw(overlay)

    text_x = art_x + art_size + cqw(3.6)
    font_title = ImageFont.truetype(str(LORA_REGULAR), int(cqw(4.2)))
    max_title_w = widget_x1 - pad - text_x
    title_text = truncate_text(draw, caption, font_title, max_title_w)
    draw.text((text_x, art_y - cqw(0.5)), title_text, font=font_title, fill=(24, 24, 27, 255))
    draw.text((text_x, art_y + cqw(5.2)), "Now Playing", font=font_title, fill=(113, 113, 122, 255))

    prog_y = art_y + art_size + cqw(3.9)
    font_time_lbl = ImageFont.truetype(str(LORA_REGULAR), int(cqw(3)))
    left_lbl_w = draw.textlength("2:04", font=font_time_lbl)
    right_lbl = "-0:51"
    right_lbl_w = draw.textlength(right_lbl, font=font_time_lbl)
    bar_h = cqw(1.9)
    bar_x0 = widget_x0 + pad + left_lbl_w + cqw(2.4)
    bar_x1 = widget_x1 - pad - right_lbl_w - cqw(2.4)
    draw.text((widget_x0 + pad, prog_y - bar_h * 0.3), "2:04", font=font_time_lbl, fill=(113, 113, 122, 255))
    draw.text((widget_x1 - pad - right_lbl_w, prog_y - bar_h * 0.3), right_lbl, font=font_time_lbl, fill=(113, 113, 122, 255))
    draw.rounded_rectangle([bar_x0, prog_y, bar_x1, prog_y + bar_h], radius=bar_h / 2, fill=(212, 212, 216, 255))
    draw.rounded_rectangle([bar_x0, prog_y, bar_x0 + (bar_x1 - bar_x0) / 3, prog_y + bar_h], radius=bar_h / 2, fill=(63, 63, 70, 255))

    ctrl_y = prog_y + bar_h + cqw(3.8)
    ctrl_color = (39, 39, 42, 255)
    prev_size, pause_size, next_size, spk_size = cqw(6), cqw(7), cqw(6), cqw(5.5)
    gap = cqw(8)
    total_ctrl_w = prev_size + gap + pause_size + gap + next_size
    ctrl_start_x = widget_x0 + (widget_x1 - widget_x0 - spk_size - gap) / 2 - total_ctrl_w / 2 - gap / 2
    x = widget_x0 + pad + ((widget_x1 - widget_x0 - 2 * pad - spk_size - gap) - total_ctrl_w) / 2
    draw_prev_icon(draw, x, ctrl_y, prev_size, ctrl_color)
    x += prev_size + gap
    draw_pause_icon(draw, x, ctrl_y, pause_size, ctrl_color)
    x += pause_size + gap
    draw_next_icon(draw, x, ctrl_y, next_size, ctrl_color)
    spk_x = widget_x1 - pad - spk_size
    draw_speaker_icon(draw, spk_x, ctrl_y + (pause_size - spk_size) / 2, spk_size, ctrl_color)

    # --- flashlight / camera row ---
    fc_y = H - cqw(9.4) - cqw(11.5) / 2
    fc_r = cqw(11.5) / 2
    left_cx = widget_x0 + fc_r
    right_cx = widget_x1 - fc_r
    for cx in (left_cx, right_cx):
        btn_layer = circle_layer(base.size, (cx, fc_y), fc_r, (255, 255, 255, 217))
        overlay = Image.alpha_composite(overlay, btn_layer)
    draw = ImageDraw.Draw(overlay)
    icon_color = (39, 39, 42, 255)
    draw_flashlight_icon(draw, left_cx, fc_y, cqw(4.7), icon_color)
    draw_camera_icon(draw, right_cx, fc_y, cqw(4.7), icon_color)

    # --- home indicator ---
    hi_w = cqw(29)
    hi_h = cqw(1)
    hi_y = H - cqw(2.1) - hi_h
    draw.rounded_rectangle([(W - hi_w) / 2, hi_y, (W + hi_w) / 2, hi_y + hi_h], radius=hi_h / 2, fill=(255, 255, 255, 179))

    result = Image.alpha_composite(base, overlay)
    return result.convert("RGB")
