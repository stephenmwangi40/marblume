// Liquid glass in solid colours: a blurred, tinted material with a crisp bright rim (no colour blends).
import 'dart:ui';
import 'package:flutter/material.dart';

const navy = Color(0xFF16213A), cream = Color(0xFFF4EEE3), bloom = Color(0xFFFF5A36), bloomDeep = Color(0xFFC8442A);

bool isDark(BuildContext c) => Theme.of(c).brightness == Brightness.dark;
Color ink(BuildContext c) => isDark(c) ? const Color(0xFFEFE9DD) : navy;
Color inkSoft(BuildContext c) => ink(c).withValues(alpha: .72);
Color paper(BuildContext c) => isDark(c) ? const Color(0xFF0F1628) : cream;

/// A translucent glass surface. Blur is real (BackdropFilter); Increase Contrast makes it solid.
class Glass extends StatelessWidget {
  final Widget child;
  final double radius;
  final EdgeInsetsGeometry padding;
  final Color? tint;
  const Glass({super.key, required this.child, this.radius = 24, this.padding = const EdgeInsets.all(16), this.tint});

  @override
  Widget build(BuildContext context) {
    final solid = MediaQuery.of(context).highContrast, dark = isDark(context) || tint != null; // tinted glass is dark glass
    final fill = tint ?? (isDark(context) ? const Color(0xFF22305A).withValues(alpha: solid ? 1 : .45) : Colors.white.withValues(alpha: solid ? 1 : .5));
    final r = BorderRadius.circular(radius);
    return DecoratedBox(
      // a crisp ledge under the glass instead of a soft shadow
      decoration: BoxDecoration(borderRadius: r, boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: dark ? .3 : .07), offset: const Offset(0, 2))]),
      child: ClipRRect(
        borderRadius: r,
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 22, sigmaY: 22),
          child: DecoratedBox(
            decoration: BoxDecoration(borderRadius: r, color: fill, border: Border.all(color: Colors.white.withValues(alpha: dark ? .16 : .8))),
            child: Padding(padding: padding, child: child),
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

/// The page behind the glass: one solid colour.
class Ambient extends StatelessWidget {
  final Widget child;
  const Ambient({super.key, required this.child});
  @override
  Widget build(BuildContext context) => ColoredBox(color: paper(context), child: child);
}
