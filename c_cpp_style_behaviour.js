define('mode/behaviour/cstyle', function(require, exports, module) {

var oop = require("ace/lib/oop");
var Behaviour = require("ace/mode/behaviour").Behaviour;

var CStyleBehaviour = function () {

    this.add("braces", "insertion", function (state, action, editor, session, text) {

        var row = editor.selection.getCursor().row;
        var col = editor.selection.getCursor().column;
        var line = session.getLine(row);
        var commentMatch = line.match(/\/\//);
        if (commentMatch) {
            line = line.substr(0, commentMatch.index - 1);
        }

        if (text == '{') {

            // remove const, noexcept from line for purposes of selection
            line = line.replace("const", "");
            line = line.replace("noexcept", "");

            // only look at the line up to the caret
            if (col) {
                line = line.substr(0, col);
            }

            if (/^\s*$/.test(line)) {
                line = session.getLine(row - 1) + line;
                row = row - 1;
            }

            var selection = editor.getSelectionRange();
            var selected = session.doc.getTextRange(selection);
            if (selected !== "") {
                return {
                    text: '{' + selected + '}',
                    selection: false
                };
            }

            // namespace specific indenting
            var anonNamespace = /namespace\s*$/.test(line);
            var namedNamespace = line.match(/namespace\s+(\w+?)\s$/);

            if (namedNamespace) {
                return {
                    text: '{} // end namespace ' + namedNamespace[1],
                    selection: [1, 1]
                };
            }

            if (anonNamespace) {
                return {
                    text: '{} // end anonymous namespace',
                    selection: [1, 1]
                };
            }

            // if we're assigning, e.g. through an initializor list, then
            // we should include a semi-colon
            if (line.match(/\=\s*$/)) {
                return {
                    text: '{};',
                    selection: [1, 1]
                };
            }

            // if we're defining a function, don't include a semi-colon
            if (line.match(/\)\s*/)) {
                return {
                    text: '{}',
                    selection: [1, 1]
                };
            }

            // if we're making a block define, don't add a semi-colon
            if (line.match(/#define\s+\w+/)) {
                return {
                    text: '{}',
                    selection: [1, 1]
                }
            }

            // if it looks like we're using a initializor eg 'obj {', then
            // include a closing ;
            if (line.match(/[\w>]+\s*$/)) {
                return {
                    text: '{};',
                    selection: [1, 1]
                };
            }
            
            // default matching scenario  
            return {
                text: '{}',
                selection: [1, 1]
            };

        } else if (text == '}') {
            var cursor = editor.getCursorPosition();
            var line = session.doc.getLine(cursor.row);
            var rightChar = line.substring(cursor.column, cursor.column + 1);
            if (rightChar == '}') {
                var matching = session.$findOpeningBracket('}', {column: cursor.column + 1, row: cursor.row});
                if (matching !== null) {
                    return {
                        text: '',
                        selection: [1, 1]
                    };
                }
            }
        } else if (text == "\n") {

            var findMatchingBracketRow = function(str, lines, row, balance) {
            
                if (row == 0) return 0;

                var line = lines[row];

                var nRight = line.split(str).length - 1;
                var nLeft = line.split(complements[str]).length - 1;
                // console.log("Line:");
                // console.log(line);
                // console.log("nLeft: " + nLeft);
                // console.log("nRight: " + nRight);
                // console.log("Row: " + row);

                balance = balance + nRight - nLeft;
                
                if (balance <= 0) {
                    return row;
                }

                return findMatchingBracketRow(str, lines, row - 1, balance);
            }

            var cursor = editor.getCursorPosition();
            var line = new String(session.doc.getLine(cursor.row));
            var rightChar = line.substring(cursor.column, cursor.column + 1);
            if (rightChar == '}') {

                // class specific indentation (if possible)
                var numTokens = 0;
                var numCommas = 0;
                var lines = session.doc.$lines;

                // walk up through the rows
                for (var i=row; i >= 0; --i) {

                    var line = lines[i];

                    if (line.match(/:/)) {
                        
                        var next_indent = Array( line.match(/[^\s]/).index + 1 ).join(" ");
                        var indent = next_indent + Array(session.getTabSize() + 1).join(" ");

                        return {
                            text: '\n' + indent + '\n' + next_indent,
                            selection: [1, indent.length, 1, indent.length]
                        }
                    }

                    // strip initial whitespace
                    line = line.replace(indent, "");
                    
                    // strip out private, virtual, public, whitespace
                    line = line.replace("public ", "");
                    line = line.replace("private ", "");
                    line = line.replace("virtual ", "");

                    // strip out anything within quotes
                    line = line.replace(/".*?"/, "");

                    // collapse whitespace
                    line = line.replace(/\s+/, " ");
                    line = line.replace(/s+{?$/, "");

                    numTokens += line.split(" ").length - 1;
                    numCommas += line.split(",").length - 1;

                    // If the following condition is true, we ran into too
                    // many tokens without enough ',' or ':'
                    if (numTokens - numCommas > 2) break;
                }

                // function-specific indentation
                if (line.match(/\)\s*/)) {

                    var openBracePos = session.findMatchingBracket({row: cursor.row, column: cursor.column + 1});
                    if (!openBracePos)
                         return null;

                    // next_indent determines where the '}' gets placed, and $getIndent
                    // seems to get it wrong by default. Hack it in here.
                    var lines = session.doc.$lines;
                    var startPos = 0;

                    for (var i=row; i >= 0; --i) {
                        var cLine = lines[i];
                        var commentMatch = cLine.match(/\/\//);
                        if (commentMatch) {
                            cLine = line.substr(0, commentMatch.index - 1);
                        }
                        if (/\(/.test(cLine)) {
                            var match = cLine.match(/(\w)/);
                            if (match) {
                                startPos = match.index + 1;
                                break;
                            }
                        }
                    }

                    var line = session.doc.getLine(cursor.row);
                    var match = line.match(/[^\s]/);
                    var indent = Array(match.index + session.getTabSize() + 1).join(" ");
                    var next_indent = Array(startPos).join(" ");
                    
                    return {
                        text: '\n' + indent + '\n' + next_indent,
                        selection: [1, indent.length + session.getTabSize(),
                                    1, indent.length + session.getTabSize()]
                    };

                }


                // default behavior -- based on just the current row
                var firstCharMatch = lines[row].match(/[^\s]/).index + 1;
                var indent = Array(firstCharMatch + session.getTabSize()).join(" ");
                var next_indent = Array(firstCharMatch).join(" ");
                return {
                    text: "\n" + indent + "\n" + next_indent,
                    selection: [1, indent.length, 1, indent.length]
                }
                
            }
        }
    });

    this.add("braces", "deletion", function (state, action, editor, session, range) {
        var selected = session.doc.getTextRange(range);
        if (!range.isMultiLine() && selected == '{') {
            var line = session.doc.getLine(range.start.row);
            var rightChar = line.substring(range.end.column, range.end.column + 1);
            if (rightChar == '}') {
                range.end.column++;
                return range;
            }
        }
    });

    this.add("parens", "insertion", function (state, action, editor, session, text) {
        if (text == '(') {
            var selection = editor.getSelectionRange();
            var selected = session.doc.getTextRange(selection);
            if (selected !== "") {
                return {
                    text: '(' + selected + ')',
                    selection: false
                };
            } else {
                return {
                    text: '()',
                    selection: [1, 1]
                };
            }
        } else if (text == ')') {
            var cursor = editor.getCursorPosition();
            var line = session.doc.getLine(cursor.row);
            var rightChar = line.substring(cursor.column, cursor.column + 1);
            if (rightChar == ')') {
                var matching = session.$findOpeningBracket(')', {column: cursor.column + 1, row: cursor.row});
                if (matching !== null) {
                    return {
                        text: '',
                        selection: [1, 1]
                    };
                }
            }
        }
    });

    this.add("parens", "deletion", function (state, action, editor, session, range) {
        var selected = session.doc.getTextRange(range);
        if (!range.isMultiLine() && selected == '(') {
            var line = session.doc.getLine(range.start.row);
            var rightChar = line.substring(range.start.column + 1, range.start.column + 2);
            if (rightChar == ')') {
                range.end.column++;
                return range;
            }
        }
    });

    this.add("brackets", "insertion", function (state, action, editor, session, text) {
        if (text == '[') {
            var selection = editor.getSelectionRange();
            var selected = session.doc.getTextRange(selection);
            if (selected !== "") {
                return {
                    text: '[' + selected + ']',
                    selection: false
                };
            } else {
                return {
                    text: '[]',
                    selection: [1, 1]
                };
            }
        } else if (text == ']') {
            var cursor = editor.getCursorPosition();
            var line = session.doc.getLine(cursor.row);
            var rightChar = line.substring(cursor.column, cursor.column + 1);
            if (rightChar == ']') {
                var matching = session.$findOpeningBracket(']', {column: cursor.column + 1, row: cursor.row});
                if (matching !== null) {
                    return {
                        text: '',
                        selection: [1, 1]
                    };
                }
            }
        }
    });

    this.add("brackets", "deletion", function (state, action, editor, session, range) {
        var selected = session.doc.getTextRange(range);
        if (!range.isMultiLine() && selected == '[') {
            var line = session.doc.getLine(range.start.row);
            var rightChar = line.substring(range.start.column + 1, range.start.column + 2);
            if (rightChar == ']') {
                range.end.column++;
                return range;
            }
        }
    });

    this.add("string_dquotes", "insertion", function (state, action, editor, session, text) {
        if (text == '"' || text == "'") {
            var quote = text;
            var selection = editor.getSelectionRange();
            var selected = session.doc.getTextRange(selection);
            if (selected !== "") {
                return {
                    text: quote + selected + quote,
                    selection: false
                };
            } else {
                var cursor = editor.getCursorPosition();
                var line = session.doc.getLine(cursor.row);
                var leftChar = line.substring(cursor.column-1, cursor.column);

                // We're escaped.
                if (leftChar == '\\') {
                    return null;
                }

                // Find what token we're inside.
                var tokens = session.getTokens(selection.start.row);
                var col = 0, token;
                var quotepos = -1; // Track whether we're inside an open quote.

                for (var x = 0; x < tokens.length; x++) {
                    token = tokens[x];
                    if (token.type == "string") {
                      quotepos = -1;
                    } else if (quotepos < 0) {
                      quotepos = token.value.indexOf(quote);
                    }
                    if ((token.value.length + col) > selection.start.column) {
                        break;
                    }
                    col += tokens[x].value.length;
                }

                // Try and be smart about when we auto insert.
                if (!token || (quotepos < 0 && token.type !== "comment" && (token.type !== "string" || ((selection.start.column !== token.value.length+col-1) && token.value.lastIndexOf(quote) === token.value.length-1)))) {
                    return {
                        text: quote + quote,
                        selection: [1,1]
                    };
                } else if (token && token.type === "string") {
                    // Ignore input and move right one if we're typing over the closing quote.
                    var rightChar = line.substring(cursor.column, cursor.column + 1);
                    if (rightChar == quote) {
                        return {
                            text: '',
                            selection: [1, 1]
                        };
                    }
                }
            }
        }
    });

    this.add("string_dquotes", "deletion", function (state, action, editor, session, range) {
        var selected = session.doc.getTextRange(range);
        if (!range.isMultiLine() && (selected == '"' || selected == "'")) {
            var line = session.doc.getLine(range.start.row);
            var rightChar = line.substring(range.start.column + 1, range.start.column + 2);
            if (rightChar == '"') {
                range.end.column++;
                return range;
            }
        }
    });

    this.add("comment", "insertion", function (state, action, editor, session, text) {
        if (text == "*") {
            var row = editor.selection.getCursor().row;
            var line = session.getLine(row);
            var indent = this.$getIndent(line);

            if (/\s*\/\*$/.test(line)) {
                return {
                    text: '*\n ' + indent + '*/',
                    selection: [1, 1]
                };
            }
        }
    });

    this.add("comment", "deletion", function (state, action, editor, session, range) {
        
        return range;

    });

    this.add("punctuation.operator", "insertion", function (state, action, editor, session, text) {
        
        // Step over ';'
        if (text == ";") {
            var cursor = editor.selection.getCursor();
            var line = session.getLine(cursor.row);
            if (line[cursor.column] == ";") {
                return {
                    text: '',
                    selection: [1, 1]
                };
            }

        }

    });

};

oop.inherits(CStyleBehaviour, Behaviour);

exports.CStyleBehaviour = CStyleBehaviour;
});
