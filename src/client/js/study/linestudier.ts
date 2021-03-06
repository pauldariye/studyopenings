import { ChessBoardWrapper } from '../common/chessboardwrapper';
import { Config } from '../common/config';
import { Line } from './line';
import { Move } from '../common/move';

declare var Chess: any;

export class LineStudier {
  private chessBoard_: ChessBoardWrapper;
  private chess_: any;
  private studyState_: StudyState_ | null;

  constructor(chessBoard: ChessBoardWrapper) {
    this.chessBoard_ = chessBoard;
    this.chess_ = new Chess();
    this.studyState_ = null;
  }

  /**
   * Begins a study of the given line. Returns a promise of whether the line was
   * successfully completed.
   */
  study(line: Line): Promise<boolean> {
    // Cancel the pending completion promise.
    if (this.studyState_ && !this.studyState_.isComplete) {
      this.studyState_.completionPromiseResolveFn(false);
    }

    var studyState = new StudyState_(line);
    this.chess_.load(line.startPosition);
    var completionPromise = new Promise<boolean>(function(resolve, reject) {
      studyState.completionPromiseResolveFn = resolve;
    });
    this.studyState_ = studyState;

    this.chessBoard_.setOrientationForColor(line.color);
    this.updateBoard_();

    if (line.opponentFirstMove) {
      this.applyMove_(line.opponentFirstMove);
      setTimeout(
          this.updateBoard_.bind(this), Config.OPPONENT_FIRST_MOVE_DELAY_MS);
    }
    return completionPromise;
  }

  tryMove(move: Move): void {
    if (!this.studyState_ || this.studyState_.isComplete) {
      throw new Error('Inappropripate call to tryMove.');
    }

    var expectedMove = this.studyState_.line.moves[this.studyState_.moveIndex];
    if (!move.equals(expectedMove)) {
      this.studyState_.wrongMoves++;
      if (this.studyState_.wrongMoves >= Config.WRONG_MOVES_FOR_ANSWER) {
        this.chessBoard_.hintMove(
            expectedMove.fromSquare, expectedMove.toSquare);
      } else if (this.studyState_.wrongMoves >= Config.WRONG_MOVES_FOR_HINT) {
        this.chessBoard_.hintSquare(expectedMove.fromSquare);
      }
      this.chessBoard_.flashWrongMove();
      this.updateBoard_();
      return;
    }

    this.chessBoard_.removeHints();
    this.studyState_.wrongMoves = 0;
    this.applyMove_(expectedMove);
    this.updateBoard_();
    if (this.studyState_.moveIndex >= this.studyState_.line.moves.length - 2) {
      this.chessBoard_.flashFinishLine();
      this.studyState_.isComplete = true;
      this.studyState_.completionPromiseResolveFn(true);
      return;
    }

    this.chessBoard_.flashRightMove();
    var opponentReply =
        this.studyState_.line.moves[this.studyState_.moveIndex + 1];
    this.applyMove_(opponentReply);
    this.studyState_.moveIndex += 2;
    setTimeout(this.updateBoard_.bind(this), Config.OPPONENT_REPLY_DELAY_MS);
  }

  applyMove_(move: Move): void {
    this.chess_.move({
      from: move.fromSquare,
      to: move.toSquare,
      promotion: 'q'
    });
  }

  updateBoard_() {
    this.chessBoard_.setStateFromChess(this.chess_);
  }
}

class StudyState_ {
  public line: Line;
  public moveIndex: number;
  public wrongMoves: number;
  public isComplete: boolean;
  public completionPromiseResolveFn: (success: boolean) => void;

  constructor(line: Line) {
    this.line = line;
    this.moveIndex = 0;
    this.wrongMoves = 0;
    this.isComplete = false;
    this.completionPromiseResolveFn = (success) => {};
  }
}