import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:marblume_flutter/game.dart';

/// Plays a level to the end by following the hint solver, like a player who always takes the hint.
int playOut(Game g) {
  for (var step = 0; step < 400 && !g.won; step++) {
    final f = g.level.frozen;
    final m = solveFirst((tubes: g.tubes, cap: g.cap, frozenTube: f?.tube ?? -1, frozenKey: f?.key ?? -1, locked: g.frozenLocked));
    expect(m, isNotNull, reason: 'level ${g.level.n}: solver found no move at step $step');
    expect(g.canMove(m!.$1, m.$2), isTrue, reason: 'level ${g.level.n}: hint suggested an illegal move');
    g.move(m.$1, m.$2);
  }
  return g.moves;
}

void main() {
  Levels.raw = (jsonDecode(File('assets/levels.json').readAsStringSync())['levels'] as List).cast<List>();

  test('levels parse with the right ball counts', () {
    expect(Levels.count, 10000);
    for (final n in [1, 137, 501, 4999, 10000]) {
      final l = Levels.at(n), counts = <int, int>{};
      for (final b in l.tubes.expand((t) => t)) { counts[b] = (counts[b] ?? 0) + 1; }
      expect(counts.values.every((c) => c == l.cap), isTrue, reason: 'level $n');
    }
  });

  test('sample levels (plain, hidden, frozen) can be played to a win', () {
    final frozen = List.generate(Levels.count, (i) => i + 1).firstWhere((n) => Levels.at(n).frozen != null);
    final hidden = List.generate(Levels.count, (i) => i + 1).firstWhere((n) => Levels.at(n).hidden.any((h) => h > 0));
    for (final n in [1, 2, 10, 25, frozen, hidden]) {
      final g = Game(Levels.at(n), expert: false);
      playOut(g);
      expect(g.won, isTrue, reason: 'level $n');
      expect(g.stars, inInclusiveRange(1, 3));
    }
  });

  test('a frozen tube cannot be used until its key colour is finished', () {
    final n = List.generate(Levels.count, (i) => i + 1).firstWhere((n) => Levels.at(n).frozen != null);
    final g = Game(Levels.at(n), expert: false), fz = g.level.frozen!;
    expect(g.isFrozen(fz.tube), isTrue);
    for (var a = 0; a < g.tubes.length; a++) { expect(g.canMove(a, fz.tube), isFalse); }
  });

  test('undo restores the board, and Expert allows only 5', () {
    final g = Game(Levels.at(1), expert: true);
    expect(g.addTube(), isFalse);
    expect(g.extraLeft, 0);
    final start = g.tubes.map((t) => [...t]).toList();
    for (var k = 0; k < 7 && !g.won; k++) {
      final f = g.level.frozen;
      final m = solveFirst((tubes: g.tubes, cap: g.cap, frozenTube: f?.tube ?? -1, frozenKey: f?.key ?? -1, locked: g.frozenLocked))!;
      g.move(m.$1, m.$2);
    }
    var undone = 0;
    while (g.undo()) { undone++; }
    expect(undone, expertUndos);
    g.restart();
    expect(g.tubes, start);
    final relaxed = Game(Levels.at(1), expert: false);
    expect(relaxed.addTube(), isTrue);
    expect(relaxed.tubes.length, start.length + 1);
  });
}
