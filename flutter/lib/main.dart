// Marblume in Flutter: the core game (10,000 levels, Expert play, undo, hints) with 3D marbles and liquid glass.
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'board.dart';
import 'game.dart';
import 'glass.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Future.wait([Levels.load(), Progress.load()]);
  runApp(const MarblumeApp());
}

/// Saved on the device: how far you are, your stars and Expert play.
class Progress {
  static late SharedPreferences _p;
  static int unlocked = 1;
  static Map<int, int> stars = {};
  static bool expert = false;
  static Future<void> load() async {
    _p = await SharedPreferences.getInstance();
    final s = jsonDecode(_p.getString('progress') ?? '{}') as Map;
    unlocked = s['unlocked'] ?? 1;
    stars = {for (final e in ((s['stars'] ?? {}) as Map).entries) int.parse(e.key): e.value as int};
    expert = s['expert'] ?? false;
  }
  static void save() => _p.setString('progress', jsonEncode({'unlocked': unlocked, 'stars': stars.map((k, v) => MapEntry('$k', v)), 'expert': expert}));
  static bool isOpen(int n) => n <= unlocked + ahead;
  /// Records a win; returns the level to play next.
  static int won(int n, int s) {
    final front = n == unlocked;
    stars[n] = stars[n] == null ? s : (stars[n]! > s ? stars[n]! : s);
    while (unlocked < Levels.count && stars[unlocked] != null) { unlocked++; } // skips levels already solved ahead
    save();
    return front ? unlocked : n + 1;
  }
}

class MarblumeApp extends StatelessWidget {
  const MarblumeApp({super.key});
  ThemeData _theme(Brightness b) => ThemeData(
        brightness: b,
        colorScheme: ColorScheme.fromSeed(seedColor: bloom, brightness: b, primary: bloom),
        splashFactory: NoSplash.splashFactory,
      );
  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Marblume',
        debugShowCheckedModeBanner: false,
        theme: _theme(Brightness.light),
        darkTheme: _theme(Brightness.dark),
        home: const HomeScreen(),
      );
}

TextStyle display(BuildContext c, double size) => TextStyle(fontSize: size, fontWeight: FontWeight.w800, height: 1.05, letterSpacing: -.02 * size, color: ink(c));
TextStyle body(BuildContext c, {double size = 15, bool soft = false, FontWeight w = FontWeight.w500}) => TextStyle(fontSize: size, fontWeight: w, height: 1.35, color: soft ? inkSoft(c) : ink(c));

Widget tierChip(Level l) => DecoratedBox(
      decoration: BoxDecoration(color: Color(l.tier.$2), borderRadius: BorderRadius.circular(99)),
      child: Padding(padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 2),
          child: Text('${l.tier.$1} · ${l.diff}', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(l.tier.$3)))),
    );

Route<T> fade<T>(Widget w) => PageRouteBuilder<T>(
      pageBuilder: (_, _, _) => w,
      transitionDuration: const Duration(milliseconds: 260),
      transitionsBuilder: (_, a, _, child) => FadeTransition(opacity: CurvedAnimation(parent: a, curve: Curves.easeOut),
          child: ScaleTransition(scale: Tween(begin: .98, end: 1.0).animate(CurvedAnimation(parent: a, curve: Curves.easeOutCubic)), child: child)),
    );

/// Centred column that never gets wider than [max] (phones, tablets and computers).
Widget column(List<Widget> children, {double max = 560}) => Center(child: ConstrainedBox(constraints: BoxConstraints(maxWidth: max), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children)));

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int get current => Progress.unlocked.clamp(1, Levels.count);
  Future<void> open(Widget w) async { await Navigator.of(context).push(fade(w)); setState(() {}); }

  @override
  Widget build(BuildContext context) {
    final l = Levels.at(current), inWorld = (current - 1) % perWorld + 1;
    return Scaffold(
      body: Ambient(
        child: SafeArea(
          child: LayoutBuilder(builder: (context, box) => SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
            // centred on tall screens instead of leaving the lower half empty
            child: ConstrainedBox(constraints: BoxConstraints(minHeight: box.maxHeight - 44), child: Center(child: column([
              Row(children: [
                Expanded(child: Text('Marblume', style: display(context, 30))),
                GlassButton(label: 'All levels', radius: 99, padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9), onTap: () => open(LevelsScreen(world: l.world)),
                    child: Text('All levels', style: body(context, size: 14, w: FontWeight.w700))),
              ]),
              const SizedBox(height: 20),
              Glass(
                tint: navy.withValues(alpha: .86),
                padding: const EdgeInsets.all(22),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('WORLD ${l.world + 1} · ${worldNames[l.world].toUpperCase()}', style: const TextStyle(color: Color(0xC2F4EEE3), fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 1)),
                  const SizedBox(height: 6),
                  Text('Level $current', style: const TextStyle(color: cream, fontSize: 40, fontWeight: FontWeight.w800, height: 1.05, letterSpacing: -.8)),
                  const SizedBox(height: 6),
                  Text('${l.tubes.where((t) => t.isNotEmpty).length} colours · ${l.tubes.length} tubes of ${l.cap} · par ${l.par}${l.type == 2 ? ' · Boss' : ''}',
                      style: const TextStyle(color: Color(0xC2F4EEE3), fontSize: 15)),
                  const SizedBox(height: 16),
                  ClipRRect(borderRadius: BorderRadius.circular(99), child: LinearProgressIndicator(value: inWorld / perWorld, minHeight: 8,
                      backgroundColor: cream.withValues(alpha: .12), valueColor: const AlwaysStoppedAnimation(cream))),
                  const SizedBox(height: 8),
                  Row(children: [Expanded(child: Text('$inWorld / $perWorld in this world', style: const TextStyle(color: Color(0xC2F4EEE3), fontSize: 13))), tierChip(l)]),
                ]),
              ),
              const SizedBox(height: 16),
              PlayButton(label: 'Play', onTap: () => open(GameScreen(level: current))),
              const SizedBox(height: 16),
              Glass(
                padding: const EdgeInsets.fromLTRB(18, 8, 10, 8),
                child: Row(children: [
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Expert play', style: body(context, w: FontWeight.w700)),
                    Text('No hints or extra tubes, $expertUndos undos a level', style: body(context, size: 13, soft: true)),
                  ])),
                  Switch.adaptive(value: Progress.expert, activeTrackColor: navy, onChanged: (v) => setState(() { Progress.expert = v; Progress.save(); })),
                ]),
              ),
              const SizedBox(height: 16),
              Text('${Progress.stars.length} levels solved · ${Progress.stars.values.fold(0, (a, b) => a + b)} stars · the next two levels are always open',
                  textAlign: TextAlign.center, style: body(context, size: 13, soft: true)),
            ]))),
          )),
        ),
      ),
    );
  }
}

/// The primary action: Marblume orange with a glass sheen, pressed on touch-down.
class PlayButton extends StatefulWidget {
  final String label;
  final VoidCallback onTap;
  const PlayButton({super.key, required this.label, required this.onTap});
  @override
  State<PlayButton> createState() => _PlayButtonState();
}

class _PlayButtonState extends State<PlayButton> {
  bool down = false;
  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        label: widget.label,
        child: GestureDetector(
          onTapDown: (_) => setState(() => down = true),
          onTapCancel: () => setState(() => down = false),
          onTapUp: (_) => setState(() => down = false),
          onTap: () { HapticFeedback.lightImpact(); widget.onTap(); },
          // solid orange on a solid darker base; pressing pushes it down onto the base
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 90),
            height: 56,
            margin: EdgeInsets.only(top: down ? 3 : 0, bottom: down ? 1 : 4),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: bloom,
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: Colors.white.withValues(alpha: .35)),
              boxShadow: [BoxShadow(color: bloomDeep, offset: Offset(0, down ? 1 : 4))],
            ),
            child: Text(widget.label, style: const TextStyle(color: navy, fontSize: 17, fontWeight: FontWeight.w800)),
          ),
        ),
      );
}

class LevelsScreen extends StatefulWidget {
  final int world;
  const LevelsScreen({super.key, required this.world});
  @override
  State<LevelsScreen> createState() => _LevelsScreenState();
}

class _LevelsScreenState extends State<LevelsScreen> {
  late int world = widget.world;
  @override
  Widget build(BuildContext context) {
    final first = world * perWorld + 1, last = (first + perWorld - 1).clamp(1, Levels.count);
    return Scaffold(
      body: Ambient(
        child: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 900),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Column(children: [
                  const SizedBox(height: 8),
                  Row(children: [
                    GlassButton(label: 'Back', radius: 99, padding: const EdgeInsets.all(10), onTap: () => Navigator.pop(context), child: Icon(Icons.arrow_back_ios_new, size: 18, color: ink(context))),
                    const SizedBox(width: 12),
                    Expanded(child: Text('Levels', style: display(context, 28))),
                  ]),
                  const SizedBox(height: 12),
                  Glass(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                    child: Row(children: [
                      IconButton(tooltip: 'Previous world', onPressed: world > 0 ? () => setState(() => world--) : null, icon: Icon(Icons.chevron_left, color: ink(context))),
                      Expanded(child: Column(children: [
                        Text('World ${world + 1} · ${worldNames[world]}', style: body(context, w: FontWeight.w700)),
                        Text('Levels $first–$last', style: body(context, size: 12, soft: true)),
                      ])),
                      IconButton(tooltip: 'Next world', onPressed: world < worldNames.length - 1 ? () => setState(() => world++) : null, icon: Icon(Icons.chevron_right, color: ink(context))),
                    ]),
                  ),
                  const SizedBox(height: 12),
                  Expanded(
                    child: GridView.builder(
                      padding: const EdgeInsets.only(bottom: 24),
                      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(maxCrossAxisExtent: 64, mainAxisSpacing: 8, crossAxisSpacing: 8),
                      itemCount: last - first + 1,
                      itemBuilder: (context, i) {
                        final n = first + i, s = Progress.stars[n], open = Progress.isOpen(n), cur = n == Progress.unlocked;
                        return Semantics(
                          button: true,
                          label: 'Level $n${s != null ? ', $s of 3 stars' : open ? '' : ', locked'}',
                          child: GestureDetector(
                            onTap: open ? () async { await Navigator.of(context).push(fade(GameScreen(level: n))); setState(() {}); } : null,
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(14),
                                color: cur ? bloom : s != null ? ink(context) : open ? Colors.white.withValues(alpha: isDark(context) ? .08 : .55) : Colors.transparent,
                                border: Border.all(color: open ? Colors.white.withValues(alpha: isDark(context) ? .14 : .8) : ink(context).withValues(alpha: .15), width: open ? 1 : 1.5),
                              ),
                              child: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                                Text('$n', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: cur ? navy : s != null ? (isDark(context) ? navy : cream) : open ? ink(context) : inkSoft(context))),
                                if (s != null) Text('★' * s, style: const TextStyle(color: bloom, fontSize: 9, height: 1.2)),
                              ])),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ]),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class GameScreen extends StatefulWidget {
  final int level;
  const GameScreen({super.key, required this.level});
  @override
  State<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends State<GameScreen> {
  late Game game = Game(Levels.at(widget.level), expert: Progress.expert);
  int? selected;
  (int, int)? hint;
  Flight? flight;
  int flights = 0, bloomed = -1;
  String tip = 'Tap a tube to lift its top ball';
  bool thinking = false;

  void say(String t) => setState(() => tip = t);

  void tap(int i) {
    if (game.won) return;
    hint = null;
    if (game.isFrozen(i)) { HapticFeedback.heavyImpact(); return say('Frozen. Finish the colour on the ice to thaw it'); }
    if (selected == null) {
      if (game.tubes[i].isEmpty || game.isDone(i)) return;
      HapticFeedback.selectionClick();
      setState(() { selected = i; tip = 'Now tap where it should go'; });
      return;
    }
    if (selected == i) return setState(() { selected = null; tip = 'Tap a tube to lift its top ball'; });
    final a = selected!;
    if (!game.canMove(a, i)) {
      HapticFeedback.heavyImpact();
      final ok = game.tubes[i].isNotEmpty && !game.isDone(i);
      return setState(() { selected = ok ? i : a; tip = 'That colour doesn\'t match — try another tube'; });
    }
    final fromLen = game.tubes[a].length, n = game.move(a, i);
    HapticFeedback.lightImpact();
    setState(() {
      selected = null;
      flight = (id: ++flights, from: a, to: i, n: n, fromLen: fromLen);
      bloomed = game.isDone(i) ? i : -1;
      tip = bloomed >= 0 ? 'Bloom! That tube is complete' : 'Nice. Keep going';
    });
    if (bloomed >= 0) Future.delayed(const Duration(milliseconds: 380), HapticFeedback.mediumImpact);
    if (game.won) {
      Future.delayed(const Duration(milliseconds: 650), win);
    } else if (!game.anyMove) {
      say(game.canUndo ? 'No moves left — Undo or Restart' : 'No moves left — Restart is always free');
    }
  }

  void undo() {
    if (game.undo()) { setState(() { selected = null; flight = null; tip = game.expert ? '${game.undoLeft} undos left' : 'Undone — undo is always free'; }); }
    else { HapticFeedback.heavyImpact(); say(game.expert && game.undoLeft == 0 ? 'No undos left. Restart is always free' : 'Nothing to undo yet'); }
  }

  void restart() => setState(() { game.restart(); selected = null; flight = null; hint = null; tip = 'Fresh start'; });

  Future<void> showHint() async {
    if (game.expert) { HapticFeedback.heavyImpact(); return say('No hints in Expert play'); }
    if (thinking) return;
    setState(() { thinking = true; tip = 'Thinking…'; });
    final f = game.level.frozen;
    final m = await compute(solveFirst, (tubes: game.tubes, cap: game.cap, frozenTube: f?.tube ?? -1, frozenKey: f?.key ?? -1, locked: game.frozenLocked));
    if (!mounted) return;
    setState(() { thinking = false; selected = null; hint = m; tip = m == null ? 'This position is tricky — try Undo a few steps' : 'Best move: from “From” to “To”'; });
    if (m != null) Future.delayed(const Duration(milliseconds: 3200), () { if (mounted && hint == m) setState(() => hint = null); });
  }

  void addTube() {
    if (game.addTube()) { HapticFeedback.lightImpact(); setState(() { selected = null; tip = 'Extra tube added'; }); }
    else { HapticFeedback.heavyImpact(); say(game.expert ? 'No extra tubes in Expert play' : 'No more extra tubes on this level'); }
  }

  Future<void> win() async {
    if (!mounted) return;
    HapticFeedback.mediumImpact();
    final s = game.stars, next = Progress.won(widget.level, s);
    final go = await showModalBottomSheet<String>(
      context: context,
      isDismissible: false,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withValues(alpha: .35),
      builder: (c) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: column([
            Glass(
              radius: 30,
              padding: const EdgeInsets.fromLTRB(22, 26, 22, 20),
              child: Column(children: [
                Text('It bloomed!', style: display(c, 32)),
                const SizedBox(height: 8),
                Text('★' * s + '☆' * (3 - s), style: const TextStyle(fontSize: 34, color: bloom, letterSpacing: 6)),
                const SizedBox(height: 8),
                Text('${game.moves} moves · par ${game.level.par}${game.expert ? ' · Expert clear' : ''}', style: body(c, soft: true)),
                const SizedBox(height: 18),
                PlayButton(label: next <= Levels.count ? 'Next level' : 'Home', onTap: () => Navigator.pop(c, 'next')),
                const SizedBox(height: 10),
                Row(children: [
                  Expanded(child: GlassButton(label: 'Replay', onTap: () => Navigator.pop(c, 'replay'), child: Center(child: Text('Replay', style: body(c, w: FontWeight.w700))))),
                  const SizedBox(width: 10),
                  Expanded(child: GlassButton(label: 'Home', onTap: () => Navigator.pop(c, 'home'), child: Center(child: Text('Home', style: body(c, w: FontWeight.w700))))),
                ]),
              ]),
            ),
          ]),
        ),
      ),
    );
    if (!mounted) return;
    if (go == 'replay') return restart();
    if (go == 'next' && next <= Levels.count) { Navigator.of(context).pushReplacement(fade(GameScreen(level: next))); return; }
    Navigator.of(context).pop();
  }

  Widget tool(String label, IconData icon, VoidCallback onTap, {String? tag, bool off = false}) => Expanded(
        child: GlassButton(
          label: label, onTap: onTap, radius: 24, padding: const EdgeInsets.symmetric(vertical: 10),
          child: Opacity(
            opacity: off ? .45 : 1,
            child: Stack(clipBehavior: Clip.none, alignment: Alignment.center, children: [
              Column(mainAxisSize: MainAxisSize.min, children: [Icon(icon, size: 22, color: ink(context)), const SizedBox(height: 2), Text(label, style: body(context, size: 12, w: FontWeight.w700))]),
              if (tag != null) Positioned(top: -6, right: 6, child: DecoratedBox(decoration: BoxDecoration(color: ink(context), borderRadius: BorderRadius.circular(8)),
                  child: Padding(padding: const EdgeInsets.symmetric(horizontal: 6), child: Text(tag, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: isDark(context) ? navy : cream))))),
            ]),
          ),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final l = game.level;
    return Scaffold(
      body: Ambient(
        child: SafeArea(
          child: Column(children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: column(max: 900, [
                Row(children: [
                  GlassButton(label: 'Back', radius: 99, padding: const EdgeInsets.all(11), onTap: () => Navigator.pop(context), child: Icon(Icons.arrow_back_ios_new, size: 18, color: ink(context))),
                  Expanded(child: Column(children: [
                    Text('LEVEL ${l.n}${l.type == 2 ? ' · BOSS' : l.type == 1 ? ' · BREATHER' : ''}', style: body(context, size: 12, soft: true, w: FontWeight.w700).copyWith(letterSpacing: 1)),
                    Text.rich(TextSpan(children: [
                      TextSpan(text: '${game.moves}', style: display(context, 26)),
                      TextSpan(text: ' / par ${l.par}', style: body(context, soft: true)),
                    ])),
                    const SizedBox(height: 2),
                    Wrap(spacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
                      if (game.expert) DecoratedBox(decoration: BoxDecoration(color: ink(context), borderRadius: BorderRadius.circular(99)),
                          child: Padding(padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 2), child: Text('Expert', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: isDark(context) ? navy : cream)))),
                      tierChip(l),
                    ]),
                  ])),
                  GlassButton(label: 'Restart', radius: 99, padding: const EdgeInsets.all(11), onTap: restart, child: Icon(Icons.refresh_rounded, size: 20, color: ink(context))),
                ]),
                const SizedBox(height: 6),
                Text(tip, textAlign: TextAlign.center, style: body(context, size: 13, soft: true)),
              ]),
            ),
            Expanded(child: Board(game: game, selected: selected, hint: hint, flight: flight, bloomed: bloomed, onTap: tap)),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
              child: column([
                Row(children: [
                  tool('Undo', Icons.undo_rounded, undo, tag: game.expert ? '${game.undoLeft}' : '∞'),
                  const SizedBox(width: 8),
                  tool('Restart', Icons.refresh_rounded, restart, tag: 'free'),
                  const SizedBox(width: 8),
                  tool('Hint', Icons.lightbulb_outline_rounded, showHint, tag: game.expert ? 'off' : null, off: game.expert),
                  const SizedBox(width: 8),
                  tool('Tube', Icons.add_rounded, addTube, tag: game.expert ? 'off' : '${game.extraLeft}', off: game.expert || game.extraLeft == 0),
                ]),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}
