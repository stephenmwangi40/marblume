// Marblume rules: the same levels file and rules as the web/Capacitor game.
import 'dart:collection';
import 'dart:convert';
import 'package:flutter/services.dart' show rootBundle;

const perWorld = 500, ahead = 2, expertUndos = 5;

const worldNames = ['Seedling', 'Sprout', 'Meadow', 'Grove', 'Orchard', 'Tide', 'Summit', 'Canyon', 'Aurora', 'Cosmos',
  'Savanna', 'Monsoon', 'Glacier', 'Lantern', 'Prism', 'Harbor', 'Nebula', 'Eclipse', 'Zenith', 'Infinity'];

/// One level as stored in levels.json: [tubes, capacity, par, difficulty, hidden, type, frozen?]
class Level {
  final int n, cap, par, diff, type;
  final List<List<int>> tubes;
  final List<int> hidden; // hidden balls at the bottom of each tube
  final ({int tube, int key})? frozen;
  Level(this.n, List l)
      : tubes = (l[0] as String).split('|').map((t) => [for (final c in t.split('')) int.parse(c, radix: 36)]).toList(),
        cap = l[1], par = l[2], diff = l[3], type = l[5],
        hidden = _hidden(l[4], (l[0] as String).split('|').length),
        frozen = l.length > 6 && l[6] is String ? _frozen(l[6]) : null;
  static List<int> _hidden(Object? h, int n) =>
      h is String && h.isNotEmpty ? [for (var i = 0; i < n; i++) i < h.length ? int.parse(h[i]) : 0] : List.filled(n, 0);
  static ({int tube, int key})? _frozen(String f) {
    final m = RegExp(r'^f(\d+)\.(\d+)$').firstMatch(f);
    return m == null ? null : (tube: int.parse(m[1]!), key: int.parse(m[2]!));
  }
  int get world => (n - 1) ~/ perWorld;
  /// Difficulty tier: name, chip colour and text colour (same as the web game).
  (String, int, int) get tier => diff < 25 ? ('Hard', 0xFF6BAA75, 0xFF16213A) : diff < 50 ? ('Very hard', 0xFFD9A030, 0xFF16213A)
      : diff < 75 ? ('Expert', 0xFFFF5A36, 0xFF16213A) : ('Master', 0xFF8A4FD8, 0xFFFFFFFF);
}

class Levels {
  static late final List<List> raw;
  static Future<void> load() async => raw = (jsonDecode(await rootBundle.loadString('assets/levels.json'))['levels'] as List).cast<List>();
  static int get count => raw.length;
  static Level at(int n) => Level(n, raw[n - 1]);
}

/// The board while you play: tubes, hidden balls, the frozen tube, moves and undo history.
class Game {
  final Level level;
  final bool expert;
  late List<List<int>> tubes;
  late List<List<bool>> hid;
  bool frozenLocked = false;
  int moves = 0, extraLeft = 0, undoLeft = 0;
  final _history = <({List<List<int>> t, List<List<bool>> h, int m, bool f})>[];

  Game(this.level, {required this.expert}) { restart(); }

  void restart() {
    tubes = [for (final t in level.tubes) [...t]];
    hid = [for (var i = 0; i < tubes.length; i++) [for (var j = 0; j < tubes[i].length; j++) j < level.hidden[i]]];
    frozenLocked = level.frozen != null;
    moves = 0;
    extraLeft = expert ? 0 : 1;
    undoLeft = expert ? expertUndos : -1; // -1: unlimited
    _history.clear();
  }

  int get cap => level.cap;
  bool isDone(int i) => tubes[i].length == cap && tubes[i].every((b) => b == tubes[i][0]);
  bool isFrozen(int i) => frozenLocked && level.frozen!.tube == i;
  bool get won => tubes.every((t) => t.isEmpty || (t.length == cap && t.every((b) => b == t[0])));
  int get stars => moves <= level.par ? 3 : moves <= (level.par * 1.3).ceil() ? 2 : 1;
  bool get canUndo => _history.isNotEmpty && undoLeft != 0;

  bool canMove(int a, int b) {
    if (a == b || isFrozen(a) || isFrozen(b) || tubes[a].isEmpty || isDone(a) || tubes[b].length >= cap) return false;
    return tubes[b].isEmpty || tubes[b].last == tubes[a].last;
  }
  bool get anyMove { for (var a = 0; a < tubes.length; a++) { for (var b = 0; b < tubes.length; b++) { if (canMove(a, b)) return true; } } return false; }

  /// Smart pour: moves the whole run of the top colour that fits. Returns how many balls moved.
  int move(int a, int b) {
    _history.add((t: [for (final t in tubes) [...t]], h: [for (final h in hid) [...h]], m: moves, f: frozenLocked));
    final c = tubes[a].last;
    var n = 0;
    while (tubes[a].isNotEmpty && tubes[a].last == c && tubes[b].length < cap) {
      tubes[b].add(tubes[a].removeLast());
      hid[a].removeLast();
      hid[b].add(false);
      n++;
    }
    if (hid[a].isNotEmpty) hid[a][hid[a].length - 1] = false; // the new top ball is revealed
    moves++;
    final f = level.frozen;
    if (frozenLocked && f != null && List.generate(tubes.length, isDone).asMap().entries.any((e) => e.value && tubes[e.key][0] == f.key)) frozenLocked = false;
    return n;
  }

  bool undo() {
    if (!canUndo) return false;
    final s = _history.removeLast();
    final added = tubes.length - s.t.length; // tubes you added stay after Undo
    tubes = [...s.t, for (var i = 0; i < added; i++) <int>[]];
    hid = [...s.h, for (var i = 0; i < added; i++) <bool>[]];
    moves = s.m;
    frozenLocked = s.f;
    if (undoLeft > 0) undoLeft--;
    return true;
  }

  bool addTube() {
    if (expert || extraLeft <= 0 || tubes.length >= 16) return false;
    extraLeft--;
    tubes.add([]);
    hid.add([]);
    return true;
  }
}

/// Hint: weighted A* over pours (same search as the level generator); returns the first move of a solution.
(int, int)? solveFirst(({List<List<int>> tubes, int cap, int frozenTube, int frozenKey, bool locked}) s) {
  final cap = s.cap;
  String key(List<List<int>> t, bool l) => (t.map((x) => x.join(',')).toList()..sort()).join('|') + (l ? '#' : '');
  int h(List<List<int>> t) { var n = 0; for (final x in t) { for (var i = 1; i < x.length; i++) { if (x[i] != x[i - 1]) n++; } } return n; }
  bool solved(List<List<int>> t) => t.every((x) => x.isEmpty || (x.length == cap && x.every((b) => b == x[0])));
  bool keyDone(List<List<int>> t) => t.any((x) => x.length == cap && x.every((b) => b == s.frozenKey));
  final seen = <String>{key(s.tubes, s.locked)};
  final open = SplayTreeMap<int, List<(List<List<int>>, int, (int, int)?, bool)>>();
  void push(List<List<int>> t, int g, (int, int)? first, bool l) => open.putIfAbsent(g + 2 * h(t), () => []).add((t, g, first, l));
  push(s.tubes, 0, null, s.locked);
  for (var expanded = 0; open.isNotEmpty && expanded < 60000; expanded++) {
    final f = open.firstKey()!, bucket = open[f]!;
    final (t, g, first, l) = bucket.removeLast();
    if (bucket.isEmpty) open.remove(f);
    if (solved(t)) return first;
    for (var a = 0; a < t.length; a++) {
      if (l && a == s.frozenTube) continue;
      final A = t[a];
      if (A.isEmpty) continue;
      final c = A.last;
      var run = 0;
      for (var k = A.length - 1; k >= 0 && A[k] == c; k--) { run++; }
      if (run == A.length && A.length == cap) continue;
      var emptyUsed = false;
      for (var b = 0; b < t.length; b++) {
        if (a == b || (l && b == s.frozenTube)) continue;
        final B = t[b];
        if (B.length >= cap) continue;
        if (B.isNotEmpty) { if (B.last != c) continue; } else { if (run == A.length || emptyUsed) continue; emptyUsed = true; }
        final next = [for (final x in t) [...x]];
        for (var k = 0; k < run && next[b].length < cap; k++) { next[b].add(next[a].removeLast()); }
        final nl = l && !keyDone(next);
        if (seen.add(key(next, nl))) push(next, g + 1, first ?? (a, b), nl);
      }
    }
  }
  return null;
}
