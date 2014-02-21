define("mode/c_cpp_matching_brace_outdent", function(require, exports, module) {

var Range = require("ace/range").Range;

var MatchingBraceOutdent = function() {};

(function() {

    this.checkOutdent = function(state, line, input) {

        if (state == "start") {

            if (/\s+private|\s+public|\s+protected/.test(line)) {
                if (input == ":") {
                    return true;
                }
            }

            if (! /^\s+$/.test(line))
                return false;

            if (/^\s*\}/.test(input)) {
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
        // we should outdent
        if (/public:\s*$|private:\s*$|protected:\s*$/.test(lineNoComment)) {
            doc.replace(new Range(row, 0, row, session.getTabSize()), "");
        }


        var match = line.match(/^(\s*\})/);
        
        if (!match) return 0;

        var column = match[1].length;
        var openBracePos = session.findMatchingBracket({row: row, column: column});

        if (!openBracePos || openBracePos.row == row) return 0;

        doc.replace(new Range(row, 0, row, column-1), indent);
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