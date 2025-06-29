import {
    Color,
    PieceType,
    Square,
    StartPosition,
    JsonNotation,
    CastlingType,
    Castling,
    Move,
    PromotionPieceType,
    MoveType,
} from '../Types';

/**
 * This class is used to convert data from one type to another.
 */
export class Converter {
    /**
     * Convert piece type to piece name
     * @example Converter.pieceTypeToPieceName(PieceType.King, Color.White), return "K"
     * @example Converter.pieceTypeToPieceName(PieceType.Knight, Color.Black), return "n"
     */
    static pieceTypeToPieceName(pieceType: PieceType, color: Color): string {
        let pieceName: string = '';

        switch (pieceType) {
            case PieceType.King:
                pieceName = 'K';
                break;
            case PieceType.Queen:
                pieceName = 'Q';
                break;
            case PieceType.Rook:
                pieceName = 'R';
                break;
            case PieceType.Bishop:
                pieceName = 'B';
                break;
            case PieceType.Knight:
                pieceName = 'N';
                break;
            case PieceType.Pawn:
                pieceName = 'P';
                break;
        }

        return color == Color.White ? pieceName : pieceName.toLowerCase();
    }

    /**
     * Convert square to squareID
     * @example Converter.squareToSquareID("a1"), return 57
     * @example Converter.squareToSquareID("h8"), return 8
     * @see For more information see Square Enum in src/Chess/Types/index.ts
     */
    static squareToSquareID(square: string): number {
        let squareID: number = 0;

        const file: number = square.charCodeAt(0) - 96;
        const rank: number = parseInt(square.charAt(1));

        // 8 - rank because the rank starts from 8
        squareID = (8 - rank) * 8 + file;

        return squareID;
    }

    /**
     * Convert squareID to square
     * @example Converter.squareIDToSquare(57), return "a1"
     * @example Converter.squareIDToSquare(8), return "h8"
     * @see For more information see Square Enum in src/Chess/Types/index.ts
     */
    static squareIDToSquare(squareID: number): string {
        let square: string = '';

        const file = squareID % 8 === 0 ? 8 : squareID % 8;
        const rank = Math.ceil(squareID / 8);

        // 97 is the char code of "a" and file + 96 because the file starts from 1
        square += String.fromCharCode(file + 96);

        // 8 - rank because the rank starts from 8
        square += (9 - rank).toString();
        return square;
    }

    /**
     * Convert Long Algebraic Notation to Move object.
     * @example Converter.lanToMove("e2e4"), return {from: Square.e2, to: Square.e4}
     * @example Converter.lanToMove("e7e8q"), return [{from: Square.e7, to: Square.e8}, {from: Square.e8, to: Square.e8}]
     */
    static lanToMove(uci: string): Move | Move[] {
        const from: Square = Square[uci.slice(0, 2) as keyof typeof Square];
        const to: Square = Square[uci.slice(2, 4) as keyof typeof Square];
        if (uci.length > 4) {
            if (!(to <= 8 || to >= 57))
                throw new Error('Invalid promotion square');

            const promotionType = uci.slice(4, 5) as PromotionPieceType;
            const promotionPieceRow: Record<PromotionPieceType, number> = {
                n: 3,
                b: 2,
                r: 1,
                q: 0,
            };
            const promotion: Square =
                to <= 8
                    ? promotionPieceRow[promotionType] * 8 + to // white promotion
                    : to - promotionPieceRow[promotionType] * 8; // black promotion

            return [
                { from, to },
                { from: to, to: promotion, type: MoveType.Promote },
            ];
        }

        return { from, to };
    }

    /**
     * Convert FEN to JSON
     * @example Converter.fenToJson("8/8/8/8/8/8/P7/8 w - - 0 1")
     * @see For more information about fen notation https://en.wikipedia.org/wiki/Forsyth%E2%80%93Edwards_Notation
     * @see For more information about Json notation etc. check src/Chess/Types/index.ts
     */
    static fenToJson(fenNotation: StartPosition | string): JsonNotation {
        fenNotation = fenNotation.trim();

        if (fenNotation.length == 0)
            throw new Error('Fen notation cannot be empty');
        else if (fenNotation.length > 100)
            throw new Error('Fen notation is too long');
        else if (fenNotation.length < 8)
            throw new Error('Fen notation is too short');

        // Split fen notation by space
        const splitFen: string[] = fenNotation.split(' ');

        // Default Json notation
        let jsonNotation: JsonNotation = {
            board: [],
            turn: Color.White,
            castling: {
                WhiteLong: false,
                WhiteShort: false,
                BlackLong: false,
                BlackShort: false,
            },
            enPassant: null,
            halfMoveClock: 0,
            fullMoveNumber: 1,
        };

        // If given fen notation has full information about game
        if (splitFen.length >= 6) {
            // Find castling availability from the fen notation
            const castlingAvailability: Castling = {
                [CastlingType.WhiteLong]: splitFen[2].includes('Q'),
                [CastlingType.WhiteShort]: splitFen[2].includes('K'),
                [CastlingType.BlackLong]: splitFen[2].includes('q'),
                [CastlingType.BlackShort]: splitFen[2].includes('k'),
            };

            // Update the default json notation
            jsonNotation = {
                board: jsonNotation.board,
                turn:
                    splitFen.length >= 2
                        ? splitFen[1] === 'w'
                            ? Color.White
                            : Color.Black
                        : Color.White,
                castling: castlingAvailability,
                enPassant:
                    splitFen.length >= 4
                        ? splitFen[3].includes('-')
                            ? null
                            : Square[splitFen[3] as keyof typeof Square]
                        : null,
                halfMoveClock: splitFen.length >= 5 ? parseInt(splitFen[4]) : 0,
                fullMoveNumber:
                    splitFen.length >= 6 ? parseInt(splitFen[5]) : 1,
            };
        }

        /**
         * Type scheme (first letter of the piece type except for the knight) for convert letter to the piece type
         * @see For more information please see above wikipedia page
         */
        const typeScheme: Record<string, PieceType> = {
            n: PieceType.Knight,
            b: PieceType.Bishop,
            p: PieceType.Pawn,
            r: PieceType.Rook,
            k: PieceType.King,
            q: PieceType.Queen,
        };

        // Rows of the board (first part of the FEN, for example "8/8/8/8/8/8/P7/8")
        const rows: string[] = splitFen[0].split('/');

        // Loop through the fen board
        for (let i: number = 0; i < 8; i++) {
            // Get current row of fen notation
            const currentRow: string = rows[i]; // 8 or P7 of the "8/8/8/8/8/8/P7/8"

            /**
             * Calculate row and column counter, for change to the json notation.
             * Row is 8 - i, because current for loop starts from 0 and fen notation starts from 8
             * Column is 0, because this is the starting point, we'll change this below.
             * @see For more information please see the wikipedia link in the description of the function.
             */
            const jsonRow: number = 8 - i;
            let jsonColumn: string = String.fromCharCode(64 + (i + 1)); // i + 1 because the column starts from 1
            let columnCounter: number = 0;

            // Loop through the current row
            for (let j: number = 0; j < currentRow.length; j++) {
                // Find current square from the current row, can be 8 or P7
                const square: string = currentRow[j];

                if (parseInt(square)) {
                    // If square is a number(is 8 or 7)
                    /**
                     * Add square to column counter for change squareID to square
                     * and find current column by column counter.
                     * @see For more information see Square Enum in src/Types.ts
                     */
                    columnCounter += parseInt(square);
                    jsonColumn = String.fromCharCode(columnCounter);
                } // If square is a letter
                else {
                    /**
                     * Add 1 to column counter for change squareID to square(means set next square)
                     * and find current column by column counter, for example if columnCounter is 52(d2)
                     * then do 53(e2) by add 1 to columnCounter.
                     * @see For more information see Square Enum in src/Chess/Types/index.ts
                     */
                    columnCounter += 1;
                    jsonColumn = String.fromCharCode(64 + columnCounter)
                        .toString()
                        .toLowerCase();

                    /**
                     * If square is a letter, that means square has piece then
                     * add piece to json notation
                     */
                    jsonNotation.board.push({
                        color:
                            square == square.toLowerCase()
                                ? Color.Black
                                : Color.White, // If square is lowercase, piece is black, otherwise piece is white
                        type: typeScheme[square.toLowerCase()], // Convert the letter to the piece type
                        square: Square[
                            (jsonColumn +
                                jsonRow.toString()) as keyof typeof Square
                        ], // Convert the column and row to the square
                    });
                }
            }
        }

        return jsonNotation;
    }

    /**
     * Convert JSON to FEN
     * @see For more information about fen notation https://en.wikipedia.org/wiki/Forsyth%E2%80%93Edwards_Notation
     */
    static jsonToFen(jsonNotation: JsonNotation): string {
        /**
         * Is char a numeric?
         */
        function isNumeric(c: string): boolean {
            return c >= '0' && c <= '9';
        }

        /**
         * Default fen notation, 8 rows and 8 columns and all of them are empty
         * @see For more information please see above wikipedia page
         */
        const fenNotation: Array<number | string> = [8, 8, 8, 8, 8, 8, 8, 8];

        /**
         * Type scheme (first letter of the piece type except for the knight) for convert piece type to the fen notation
         * @see For more information please see above wikipedia page
         */
        const typeScheme: Record<PieceType, string> = {
            [PieceType.Knight]: 'n',
            [PieceType.Bishop]: 'b',
            [PieceType.Pawn]: 'p',
            [PieceType.Rook]: 'r',
            [PieceType.King]: 'k',
            [PieceType.Queen]: 'q',
        };

        /**
         * Board for convert json notation to the fen notation.
         * Initialize the board with 8 rows and 8 columns and fill it with 1, means empty.
         * This board is a bridge between json notation and fen notation. Why we need this?
         * Because if convert json notation to the fen notation directly then our algorithm will be
         * big-o(n^3) but if we use this bridge then we can reduce(but we will use more space) it to big-o(n^2).
         *
         * Bridge: {8:[1, 1, 1, 1, 1, 1, 1, 1], 7:[1, 1, 1, 1, 1, 1, 1, 1], ..., 1:[1, 1, 1, 1, 1, 1, 1, 1]}
         */
        const jsonToFenBridgeBoard: Record<number, Array<number | string>> = {};

        for (let i = 0; i < 8; i++) {
            jsonToFenBridgeBoard[i + 1] = [1, 1, 1, 1, 1, 1, 1, 1];
        }

        // Loop through the jsonNotation
        for (const i in jsonNotation.board) {
            // Current piece
            const piece: { color: Color; type: PieceType; square: Square } =
                jsonNotation.board[Number(i)];

            // Convert squareID to square
            const square: string = Converter.squareIDToSquare(piece['square']);

            // Type of the piece
            const type: string = typeScheme[piece['type']];

            /**
             * Convert square to the place, for example if square is a1 then square.charCodeAt(0) is 97
             * and 'a'.charCodeAt(0) is 97 then 97 - 97 = 0, means place is 0 or if square is b1 then
             * square.charCodeAt(0) is 98 and 'a'.charCodeAt(0) is 97 then 98 - 97 = 1, means place is 1
             */
            const place: number = square.charCodeAt(0) - 'a'.charCodeAt(0);

            /**
             * If piece is black then convert type to lowercase, otherwise convert type to uppercase(fen notation)
             * and set the piece to the board by place and row.
             * @see For more information about fen notation please see above wikipedia page
             */
            const row: number = parseInt(square.charAt(1));
            jsonToFenBridgeBoard[row][place] =
                piece['color'] == Color.Black
                    ? type.toLowerCase()
                    : type.toUpperCase();
        }

        // Row counter for fen notation. Example, every "/" of (8/8/8/8/8/8/8/8)
        let fenRowCounter: number = 0;

        // Loop through the board
        for (
            let i = 8;
            i > 0;
            i-- // We start from 8 to 0 because fen notation starts from 8th row
        ) {
            // Current row of the board
            const row: Array<number | string> = jsonToFenBridgeBoard[i];

            /**
             * Fen string initialize for current row. We will increment this string
             * with the square or number.
             */
            let fenRow: string = '0';

            // Loop through the row
            for (let t = 0; t < 8; t++) {
                // Current square of the row (square can be number or letter)
                const square: number | string = row[t];

                // If square is number then increment fenString with square
                if (isNumeric(square.toString())) {
                    /**
                     * Get last char of the fenRow and add 1 to it then add it to the fenRow again.
                     * For example, if fenString is "7" then last char is "7" and "7" + 1 is "8" or
                     * if fenString is "p1" then last char is "1" and "1" + 1 is "2" then add it to
                     * the fenString again, so fenString is "p2".
                     */
                    const lastChar = fenRow.slice(-1);
                    fenRow = isNumeric(lastChar)
                        ? fenRow.slice(0, -1) + (parseInt(lastChar) + 1)
                        : fenRow + '1';
                } else {
                    /**
                     * If square is not number then add it to the fenRow directly. For example,
                     * if fenString is "7" then last char is "7" and "7" + "p" is "7p" or if
                     * fenString is "k1" then last char is "1" and "1" + "p" is "1p" then add it to
                     * the fenString again, so fenString is "k1p".
                     */
                    fenRow += square;
                }
            }

            // Set fenRow to the fenNotation array and increment fenRowCounter by 1 for next row
            // Also replace 0(initialize value) with empty string because fen notation does not have 0
            fenNotation[fenRowCounter] = fenRow.replace('0', '');
            fenRowCounter++;
        }

        /**
         * Get turn, castling, en passant, half move clock and full move number from the json notation
         * and convert them to the fen notation.
         */
        const turn: string = jsonNotation.turn == Color.White ? 'w' : 'b';
        const castling: string =
            (jsonNotation.castling.WhiteShort ? 'K' : '') +
            (jsonNotation.castling.WhiteLong ? 'Q' : '') +
            (jsonNotation.castling.BlackShort ? 'k' : '') +
            (jsonNotation.castling.BlackLong ? 'q' : '');
        const enPassant: string =
            jsonNotation.enPassant == null
                ? '-'
                : Converter.squareIDToSquare(jsonNotation.enPassant);

        // Return fen notation as string with space between them
        return (
            fenNotation.join('/') +
            ' ' +
            turn +
            ' ' +
            (castling == '' ? '-' : castling) +
            ' ' +
            enPassant +
            ' ' +
            jsonNotation.halfMoveClock.toString() +
            ' ' +
            jsonNotation.fullMoveNumber.toString()
        );
    }

    /**
     * Convert JSON Board to ASCII ChessBoard.
     */
    static jsonToASCII(jsonNotation: JsonNotation): string {
        let emptySchema: string = `
        +---+---+---+---+---+---+---+---+
        |a8  b8  c8  d8  e8  f8  g8  h8 | 8
        |a7  b7  c7  d7  e7  f7  g7  h7 | 7
        |a6  b6  c6  d6  e6  f6  g6  h6 | 6
        |a5  b5  c5  d5  e5  f5  g5  h5 | 5
        |a4  b4  c4  d4  e4  f4  g4  h4 | 4
        |a3  b3  c3  d3  e3  f3  g3  h3 | 3
        |a2  b2  c2  d2  e2  f2  g2  h2 | 2
        |a1  b1  c1  d1  e1  f1  g1  h1 | 1
        +---+---+---+---+---+---+---+---+
          a   b   c   d   e   f   g   h
        `;

        // Replace square numbers with pieces
        const filledSquares: string[] = [];
        for (const piece of jsonNotation.board) {
            const square: string = Converter.squareIDToSquare(piece.square);
            emptySchema = emptySchema.replace(
                square,
                ' ' + Converter.pieceTypeToPieceName(piece.type, piece.color),
            );
            filledSquares.push(square);
        }

        // Replace empty squares with "."
        for (let i = 1; i <= 64; i++) {
            const square: string = Converter.squareIDToSquare(i);
            if (!filledSquares.includes(square))
                emptySchema = emptySchema.replace(square.toString(), ' .');
        }

        return emptySchema;
    }
}
