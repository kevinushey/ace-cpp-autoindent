define("mode/c_cpp_matching_brace_outdent", function(require, exports, module) {

var Range = require("ace/range").Range;

var MatchingBraceOutdent = function() {};

(function() {

    this.checkOutdent = function(state, line, input) {

        if (state == "start") {

            // private: / public: / protected:
            if (input == ":") {
                return true;
            }

            // outdenting for '\'
            if (input == "\\") {
                return true;
            }

            if (! /^\s+$/.test(line))
                return false;

            if (/^\s*\}/.test(input)) {
                return true;
            }

        }

        // check for nudging of '/' to the left (?)
        if (state == "comment") {

            if (input == "/") {
                return true;
            }

        }

    };

    this.autoOutdent = function(session, row) {

        var doc = session.doc;
        var line = doc.$lines[row];
        var indent = this.$getIndent(line);
        var commentMatch = line.match(/\/\//);
        var lineNoComment;
        if (commentMatch) {
            lineNoComment = line.substr(0, commentMatch.index - 1);
        } else {
            lineNoComment = line;
        }

        // if we just typed 'public:', 'private:' or 'protected:',
        // we should outdent if possible
        if (/public:\s*$|private:\s*$|protected:\s*$/.test(lineNoComment)) {

            // look for the enclosing 'class' to get the indentation
            var len = 0;
            for (var i=row; i >= 0; i--) {
                console.log(i);
                var line = doc.$lines[i];
                var match = line.match(/class /);
                if (match) {
                    len = match.index;
                    break;
                }
            }

            doc.replace(new Range(row, 0, row, indent.length - len), "");
        }

        // If we're within a #define macro, then we should nudge any '\' to the right
        // TODO: Right now we just drop any auto-generated matching tokens. Should
        // we keep them?
        var inMacro = function(lines, thisRow) {
            if (/#define/.test(lines[thisRow])) {
                return true;
            } else if (/\\\s*$/.test(lines[thisRow-1])) {
                return inMacro(lines, thisRow-1);
            } else {
                return false;
            }
        }

        if (/\\/.test(line) && inMacro(doc.$lines, row)) {

            var col = session.selection.getCursor().column;

            // Move all text to the right of the '\' alongside it to the right
            var rightText = line.substr(col);
            var range = new Range(row, col - 1, row, 60);
            
            if (/#define/.test(line)) {
                doc.replace(range, Array(60 - col).join(" ") + "\\" + rightText);
            } else {
                console.log(range);
                console.log(Array(60 - col).join(" "));
                doc.replace(range, Array(60 - col).join(" ") + "\\");
            }

            // move the cursor to just after the inserted '\'
            var loc = doc.$lines[row].match(/\\/);
            session.selection.moveCursorTo(row, loc.index + 1);
            return 0;
        }

        // If we typed a / to close a block comment, be nice and nudge it left
        // but what if the user wants a literal '/' inside a block comment?
        // if (/\*\s+\/$/.test(line)) {
        //     doc.replace(new Range(row, indent.length, row, line.length), "*/");
        //     return 0;
        // }

        var match = line.match(/^(\s*\})/);
        
        if (!match) return 0;

        var column = match[1].length;
        var openBracePos = session.findMatchingBracket({row: row, column: column});

        if (!openBracePos) return 0;

        // move the brace to the starting text position for the matching brace
        var start = doc.$lines[openBracePos.row].match(/\w/).index;
        
        if (line.match(/\s*/)) {
            var col = session.selection.getCursor().column;
            doc.replace(
                new Range(row, 0, row, col), 
                Array(start + 1).join(" ") + "}"
            );
        }
        
    };

    this.$getIndent = function(line) {
        var match = line.match(/^(\s+)/);
        if (match) {
            return match[1];
        }

        return "";
    };

}).call(MatchingBraceOutdent.prototype);

exports.MatchingBraceOutdent = MatchingBraceOutdent;
});