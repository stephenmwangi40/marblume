// Liquid glass: blurred, tinted material with a sheen and a bright rim, over slowly drifting coloured light.
import 'dart:math';
import 'dart:ui';
import 'package:flutter/material.dart';

const navy = Color(0xFF16213A), navy2 = Color(0xFF22305A), cream = Color(0xFFF4EEE3), bloom = Color(0xFFFF5A36), leaf = Color(0xFF6BAA75), lake = Color(0xFF3E7CB1);

bool isDark(BuildContext c) => Theme.of(c).brightness == Brightness.dark;
Color ink(BuildContext c) => isDark(c) ? const Color(0xFFEFE9DD) : navy;
Color inkSoft(BuildContext c) => ink(c).withValues(alpha: .72);

/// A translucent glass surface. Blur is real (BackdropFilter); the device's Reduce Transparency makes it solid.
class Glass extends StatelessWidget {
  final Widget child;
  final double radius;
  final EdgeInsetsGeometry padding;
  final Color? tint;
  const Glass({super.key, required this.child, this.radius = 24, this.padding = const EdgeInsets.all(16), this.tint});

  @override
  Widget build(BuildContext context) {
    final solid = MediaQuery.of(context).highContrast, dark = isDark(context) || tint != null; // tinted glass is dark glass
    final fill = tint ?? (dark ? const Color(0xFF22305A).withValues(alpha: solid ? 1 : .45) : Colors.white.withValues(alpha: solid ? 1 : .5));
    final r = BorderRadius.circular(radius);
    return DecoratedBox(
      decoration: BoxDecoration(borderRadius: r, boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: dark ? .28 : .08), blurRadius: 18, offset: const Offset(0, 6))]),
      child: ClipRRect(
        borderRadius: r,
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 22, sigmaY: 22),
          child: DecoratedBox(
            decoration: BoxDecoration(borderRadius: r, color: fill),
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: r,
                // sheen: light catching the top-left of the material, and a bright rim
                gradient: solid ? null : LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, stops: const [0, .34, .55, 1],
                    colors: [Colors.white.withValues(alpha: dark ? .13 : .6), Colors.white.withValues(alpha: dark ? .02 : .1), Colors.white.withValues(alpha: 0), Colors.white.withValues(alpha: dark ? .05 : .2)]),
                border: Border.all(color: Colors.white.withValues(alpha: dark ? .14 : .75), width: 1),
              ),
              child: Padding(padding: padding, child: child),
            ),
          ),
        ),
      ),
    );
  }
}

/// Glass button: highlights on touch-down (not on release) and springs back.
class GlassButton extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;
  final double radius;
  final EdgeInsetsGeometry padding;
  final Color? tint;
  final String? label;
  const GlassButton({super.key, required this.child, this.onTap, this.radius = 22, this.padding = const EdgeInsets.all(12), this.tint, this.label});
  @override
  State<GlassButton> createState() => _GlassButtonState();
}

class _GlassButtonState extends State<GlassButton> {
  bool down = false;
  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        enabled: widget.onTap != null,
        label: widget.label,
        child: GestureDetector(
          onTapDown: (_) => setState(() => down = true),
          onTapUp: (_) => setState(() => down = false),
          onTapCancel: () => setState(() => down = false),
          onTap: widget.onTap,
          child: AnimatedScale(
            scale: down ? .95 : 1,
            duration: const Duration(milliseconds: 110),
            curve: Curves.easeOut,
            child: Opacity(opacity: widget.onTap == null ? .45 : 1, child: Glass(radius: widget.radius, padding: widget.padding, tint: widget.tint, child: widget.child)),
          ),
        ),
      );
}

/// Soft brand-coloured light that drifts slowly behind the glass (still when the device asks for less motion).
class Ambient extends StatefulWidget {
  final Widget child;
  const Ambient({super.key, required this.child});
  @override
  State<Ambient> createState() => _AmbientState();
}

class _AmbientState extends State<Ambient> with SingleTickerProviderStateMixin {
  late final AnimationController c = AnimationController(vsync: this, duration: const Duration(seconds: 24))..repeat();
  @override
  void dispose() { c.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    final dark = isDark(context), still = MediaQuery.of(context).disableAnimations;
    return Stack(children: [
      Positioned.fill(child: ColoredBox(color: dark ? const Color(0xFF0F1628) : cream)),
      Positioned.fill(
        child: RepaintBoundary(
          child: AnimatedBuilder(
            animation: c,
            builder: (_, _) => CustomPaint(painter: _Blobs(still ? 0 : c.value, dark)),
          ),
        ),
      ),
      Positioned.fill(child: widget.child),
    ]);
  }
}

class _Blobs extends CustomPainter {
  final double t;
  final bool dark;
  _Blobs(this.t, this.dark);
  @override
  void paint(Canvas canvas, Size s) {
    final a = t * 2 * pi;
    for (final (color, x, y, r, alpha) in [
      (bloom, .1 + .08 * sin(a), .05 + .05 * cos(a), .75, dark ? .2 : .2),
      (leaf, .95 + .06 * cos(a), .35 + .06 * sin(a), .7, dark ? .16 : .22),
      (lake, .4 + .08 * sin(a + 1), 1.0 + .04 * cos(a), .8, dark ? .24 : .17),
    ]) {
      final c = Offset(x * s.width, y * s.height), rad = r * max(s.width, s.height) * .6;
      canvas.drawCircle(c, rad, Paint()..shader = RadialGradient(colors: [color.withValues(alpha: alpha), color.withValues(alpha: 0)]).createShader(Rect.fromCircle(center: c, radius: rad)));
    }
  }
  @override
  bool shouldRepaint(_Blobs o) => o.t != t || o.dark != dark;
}
