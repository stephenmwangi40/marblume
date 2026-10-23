// The board: 3D marbles in glass tubes. Layout, drawing and the arc a pour follows.
import 'dart:math';
import 'package:flutter/material.dart';
import 'game.dart';
import 'glass.dart';

const ballColors = [0xFF3E7CB1, 0xFFE9B44C, 0xFF6BAA75, 0xFF9B5DE5, 0xFFE56B9F, 0xFF2EC4B6, 0xFF8D6A4F, 0xFF5C6B73, 0xFFA7C957, 0xFF6FB7D9, 0xFFC8A2D6, 0xFFC9895A];
const ballSymbols = ['●', '▲', '■', '◆', '♥', '★', '✚', '☾', '✿', '◐', '✦', '⬟'];

/// A pour in progress: balls leave tube [from] (which held [fromLen]) and land on top of tube [to].
typedef Flight = ({int id, int from, int to, int n, int fromLen});

/// Tube and ball sizes for the space available: tries 1-4 rows and keeps the biggest balls that fit
/// (a single edge-to-edge strip loses to two rows when the balls stay nearly as big).
({double bs, double tw, double g, double rg, int per, int rows}) fitBoard(int nT, int cap, double W, double H) {
  ({double bs, double tw, double g, double rg, int per, int rows})? best;
  double bestScore = 0;
  final maxBs = min(W, H * 1.4) >= 900 ? 96.0 : min(W, H * 1.4) >= 700 ? 84.0 : 72.0;
  for (var rows = 1; rows <= min(4, nT); rows++) {
    final per = (nT / rows).ceil();
    for (var bs = min(maxBs, (W / per).floorToDouble()); bs >= 12; bs--) {
      final tw = bs + 12, g = max(8.0, bs * .32).roundToDouble(), rg = max(30.0, bs * .62).roundToDouble();
      final w = per * tw + (per - 1) * g, h = rows * (cap * (bs + 4) + 14) + (rows - 1) * rg + bs * .8;
      if (w <= W && h <= H) {
        final score = bs * (w > W * .9 && rows == 1 && nT > 8 ? .88 : 1);
        if (score > bestScore) { bestScore = score; best = (bs: bs, tw: tw, g: g, rg: rg, per: per, rows: rows); }
        break;
      }
    }
  }
  return best ?? (bs: 12.0, tw: 24.0, g: 6.0, rg: 24.0, per: (nT / 2).ceil(), rows: 2);
}

class Board extends StatefulWidget {
  final Game game;
  final int? selected;
  final (int, int)? hint;
  final Flight? flight;
  final int bloomed; // tube that was just finished (-1 none)
  final void Function(int tube) onTap;
  const Board({super.key, required this.game, required this.selected, required this.hint, required this.flight, required this.bloomed, required this.onTap});
  @override
  State<Board> createState() => _BoardState();
}

class _BoardState extends State<Board> with SingleTickerProviderStateMixin {
  late final AnimationController fly = AnimationController(vsync: this, duration: const Duration(milliseconds: 420))
    ..addStatusListener((s) { if (s == AnimationStatus.completed) setState(() {}); });

  @override
  void didUpdateWidget(Board old) {
    super.didUpdateWidget(old);
    if (widget.flight != null && widget.flight!.id != old.flight?.id) {
      fly.duration = Duration(milliseconds: MediaQuery.of(context).disableAnimations ? 1 : 360 + 60 * (widget.flight!.n - 1));
      fly.forward(from: 0);
    }
  }

  @override
  void dispose() { fly.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => LayoutBuilder(builder: (context, box) {
        final g = widget.game, nT = g.tubes.length, cap = g.cap;
        final f = fitBoard(nT, cap, box.maxWidth - 16, box.maxHeight - 28);
        final th = cap * (f.bs + 4) + 14;
        // tube positions, rows centred
        final pos = <Offset>[];
        final totalH = f.rows * th + (f.rows - 1) * f.rg;
        for (var i = 0; i < nT; i++) {
          final row = i ~/ f.per, inRow = min(f.per, nT - row * f.per);
          final rowW = inRow * f.tw + (inRow - 1) * f.g;
          pos.add(Offset((box.maxWidth - rowW) / 2 + (i % f.per) * (f.tw + f.g), (box.maxHeight - totalH) / 2 + row * (th + f.rg) + f.bs * .4));
        }
        Offset slot(int t, int j, {bool lifted = false}) =>
            pos[t] + Offset(6, th - 7 - (j + 1) * (f.bs + 4) + 2) + Offset(0, lifted ? -10 - f.bs * .75 : (widget.selected == t ? -10 : 0));
        final flight = widget.flight, flying = flight != null && fly.isAnimating;
        final children = <Widget>[];
        for (var i = 0; i < nT; i++) {
          final up = widget.selected == i ? -10.0 : 0.0;
          final hint = widget.hint == null ? null : widget.hint!.$1 == i ? 'From' : widget.hint!.$2 == i ? 'To' : null;
          children.add(AnimatedPositioned(
            key: ValueKey('t$i'), duration: const Duration(milliseconds: 180), curve: Curves.easeOutBack,
            left: pos[i].dx, top: pos[i].dy + up, width: f.tw, height: th,
            child: _Tube(done: g.isDone(i), frozen: g.isFrozen(i), hint: hint, selected: widget.selected == i, bloomed: widget.bloomed == i,
                frozenKey: g.isFrozen(i) ? g.level.frozen!.key : null, ballSize: f.bs),
          ));
          final t = g.tubes[i];
          final hiddenTop = flying && flight.to == i ? flight.n : 0; // balls still in the air
          for (var j = 0; j < t.length - hiddenTop; j++) {
            final lifted = widget.selected == i && j == t.length - 1;
            final p = slot(i, j, lifted: lifted);
            children.add(AnimatedPositioned(
              key: ValueKey('b$i.$j'), duration: Duration(milliseconds: lifted ? 220 : 160), curve: lifted ? Curves.easeOutBack : Curves.easeOut,
              left: p.dx, top: p.dy, width: f.bs, height: f.bs,
              child: Ball(color: t[j], size: f.bs, hidden: g.hid[i][j]),
            ));
          }
          // reflection streak in front of the balls
          children.add(Positioned(left: pos[i].dx + f.tw * .16, top: pos[i].dy + up + 10, width: f.tw * .13, height: th - 10 - f.tw / 3,
              child: const IgnorePointer(child: DecoratedBox(decoration: BoxDecoration(borderRadius: BorderRadius.all(Radius.circular(99)),
                  gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xB3FFFFFF), Color(0x1FFFFFFF), Color(0x00FFFFFF)], stops: [0, .7, 1]))))));
          children.add(Positioned(left: pos[i].dx - f.g / 2, top: pos[i].dy - 12, width: f.tw + f.g, height: th + 24,
              child: Semantics(button: true, label: 'Tube ${i + 1}, ${t.length} of $cap balls${g.isFrozen(i) ? ', frozen' : ''}',
                  child: GestureDetector(behavior: HitTestBehavior.opaque, onTapDown: (_) => widget.onTap(i)))));
        }
        if (flying) {
          final to = g.tubes[flight.to];
          for (var k = 0; k < flight.n; k++) {
            final a = slot(flight.from, flight.fromLen - 1 - k).translate(0, -10 - (k == 0 ? f.bs * .75 : 0)), b = slot(flight.to, to.length - flight.n + k);
            children.add(AnimatedBuilder(
              animation: fly,
              builder: (_, child) {
                final span = 1 - .15 * (flight.n - 1), u = Curves.easeInOutCubic.transform(((fly.value - .15 * k) / span).clamp(0.0, 1.0));
                final apex = min(a.dy, b.dy) - max(26.0, f.bs * .9), c = Offset((a.dx + b.dx) / 2, 2 * apex - (a.dy + b.dy) / 2);
                final p = a * (1 - u) * (1 - u) + c * 2 * u * (1 - u) + b * u * u;
                return Positioned(left: p.dx, top: p.dy, width: f.bs, height: f.bs, child: child!);
              },
              child: Ball(color: to[to.length - flight.n + k], size: f.bs, hidden: false),
            ));
          }
        }
        return Stack(clipBehavior: Clip.none, children: children);
      });
}

/// A glass tube: a cylinder lit from the left, with a cap when finished and ice when frozen.
class _Tube extends StatelessWidget {
  final bool done, frozen, selected, bloomed;
  final String? hint;
  final int? frozenKey;
  final double ballSize;
  const _Tube({required this.done, required this.frozen, required this.hint, required this.selected, required this.bloomed, required this.frozenKey, required this.ballSize});
  @override
  Widget build(BuildContext context) {
    final dark = isDark(context), edge = hint != null ? bloom : selected || done ? ink(context) : ink(context).withValues(alpha: dark ? .32 : .22);
    final a = Colors.white.withValues(alpha: dark ? .07 : .5), b = Colors.white.withValues(alpha: dark ? .18 : .88);
    final shape = RoundedRectangleBorder(side: BorderSide(color: edge, width: hint != null ? 3 : 2.5),
        borderRadius: BorderRadius.vertical(top: const Radius.circular(10), bottom: Radius.circular(ballSize / 2 + 6)));
    return Stack(clipBehavior: Clip.none, children: [
      Positioned.fill(
        child: AnimatedScale(
          scale: bloomed ? 1.06 : 1, duration: const Duration(milliseconds: 220), curve: Curves.easeOutBack,
          child: DecoratedBox(
            decoration: ShapeDecoration(
              shape: shape,
              gradient: frozen
                  ? const LinearGradient(colors: [Color(0xF2D6EEFC), Color(0xD9AAD6F0), Color(0xF2D6EEFC)])
                  : done
                      ? LinearGradient(colors: [ink(context).withValues(alpha: .08), ink(context).withValues(alpha: .15)])
                      : LinearGradient(colors: [a, b, a, a, b, a], stops: const [0, .14, .32, .72, .9, 1]),
              shadows: [BoxShadow(color: Colors.black.withValues(alpha: selected ? .34 : .28), blurRadius: selected ? 14 : 10, offset: Offset(0, selected ? 18 : 8), spreadRadius: -6)],
            ),
          ),
        ),
      ),
      if (done) Positioned(top: -10, left: 5, right: 5, height: 9, child: DecoratedBox(decoration: BoxDecoration(color: ink(context), borderRadius: BorderRadius.circular(6)))),
      if (done) Positioned(top: -34, left: 0, right: 0, child: const Center(child: Text('✿', style: TextStyle(color: bloom, fontSize: 20)))),
      if (frozen && frozenKey != null)
        Positioned.fill(child: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('❄', style: TextStyle(fontSize: 20, color: Color(0xFF2D6E99))),
          const SizedBox(height: 6),
          Ball(color: frozenKey!, size: ballSize * .62, hidden: false),
        ]))),
      if (hint != null)
        Positioned(top: -30, left: -20, right: -20, child: Center(child: DecoratedBox(
          decoration: BoxDecoration(color: bloom, borderRadius: BorderRadius.circular(10)),
          child: Padding(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3), child: Text(hint!, style: const TextStyle(color: navy, fontSize: 11, fontWeight: FontWeight.w700))),
        ))),
    ]);
  }
}

/// A marble drawn as a lit sphere: specular highlight, shadowed far side, bounce light and a contact shadow.
class Ball extends StatelessWidget {
  final int color;
  final double size;
  final bool hidden;
  const Ball({super.key, required this.color, required this.size, required this.hidden});
  @override
  Widget build(BuildContext context) => RepaintBoundary(
        child: CustomPaint(
          size: Size.square(size),
          painter: _BallPainter(hidden ? const Color(0xFFCFC6B8) : Color(ballColors[color % ballColors.length])),
          child: SizedBox.square(
            dimension: size,
            child: Center(
              child: Text(hidden ? '?' : ballSymbols[color % ballSymbols.length],
                  style: TextStyle(fontSize: size * .36, height: 1, fontWeight: FontWeight.w800,
                      color: hidden ? const Color(0xFF3A4560) : Colors.white.withValues(alpha: .95),
                      shadows: hidden ? null : const [Shadow(color: Color(0x40000000), blurRadius: 1, offset: Offset(0, 1))])),
            ),
          ),
        ),
      );
}

class _BallPainter extends CustomPainter {
  final Color c;
  _BallPainter(this.c);
  @override
  void paint(Canvas canvas, Size s) {
    final r = s.width / 2, center = Offset(r, r), rect = Rect.fromCircle(center: center, radius: r);
    canvas.drawCircle(center.translate(0, r * .14), r * .96, Paint()..color = const Color(0x4D0A1020)..maskFilter = MaskFilter.blur(BlurStyle.normal, r * .12));
    canvas.drawCircle(center, r, Paint()..shader = RadialGradient(center: const Alignment(-.24, -.36), radius: 1.05,
        colors: [Color.lerp(c, Colors.white, .22)!, c, Color.lerp(c, Colors.black, .38)!], stops: const [0, .5, 1]).createShader(rect));
    canvas.drawCircle(center, r, Paint()..shader = RadialGradient(center: const Alignment(0, 1.16), radius: .84,
        colors: [Colors.white.withValues(alpha: .38), Colors.white.withValues(alpha: 0)]).createShader(rect));
    canvas.drawCircle(center, r, Paint()..shader = RadialGradient(center: const Alignment(-.36, -.52), radius: .6,
        colors: [Colors.white.withValues(alpha: .95), Colors.white.withValues(alpha: .45), Colors.white.withValues(alpha: 0)], stops: const [0, .18, 1]).createShader(rect));
  }
  @override
  bool shouldRepaint(_BallPainter o) => o.c != c;
}
