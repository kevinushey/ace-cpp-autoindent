/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Ajax.org Code Editor (ACE).
 *
 * The Initial Developer of the Original Code is
 * Ajax.org B.V.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *      Fabian Jakobs <fabian AT ajax DOT org>
 *      Gastón Kleiman <gaston.kleiman AT gmail DOT com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

define("mode/cpp", function(require, exports, module) 
{
    var Editor = require("ace/editor").Editor;
    var EditSession = require("ace/edit_session").EditSession;
    var oop = require("ace/lib/oop");
    var TextMode = require("ace/mode/text").Mode;
    var Tokenizer = require("ace/tokenizer").Tokenizer;
    var c_cppHighlightRules = require("mode/c_cpp_highlight_rules").c_cppHighlightRules;
    var MatchingBraceOutdent = require("mode/c_cpp_matching_brace_outdent").MatchingBraceOutdent;
    var Range = require("ace/range").Range;
    var CStyleBehaviour = require("mode/behaviour/cstyle").CStyleBehaviour;
    var CStyleFoldMode = require("ace/mode/folding/cstyle").FoldMode;
    
    var Mode = function(suppressHighlighting, doc, session) {
        this.$tokenizer = new Tokenizer(new c_cppHighlightRules().getRules());
        this.$outdent = new MatchingBraceOutdent();
        this.$behaviour = new CStyleBehaviour();
        this.$doc = doc;
        this.foldingRules = new CStyleFoldMode();
    };
    oop.inherits(Mode, TextMode);

    (function() {

    this.toggleCommentLines = function(state, doc, startRow, endRow) {
        var outdent = true;
        var re = /^(\s*)\/\//;

        for (var i=startRow; i<= endRow; i++) {
            if (!re.test(doc.getLine(i))) {
                outdent = false;
                break;
            }
        }

        if (outdent) {
            var deleteRange = new Range(0, 0, 0, 0);
            for (var i=startRow; i<= endRow; i++)
            {
                var line = doc.getLine(i);
                var m = line.match(re);
                deleteRange.start.row = i;
                deleteRange.end.row = i;
                deleteRange.end.column = m[0].length;
                doc.replace(deleteRange, m[1]);
            }
        }
        else {
            doc.indentRows(startRow, endRow, "//");
        }
    };

    this.getNextLineIndent = function(state, line, tab, tabSize, row) {

        var inMacro = function(lines, thisRow) {
            if (/#define/.test(lines[thisRow])) {
                return true;
            } else if (/\\$/.test(lines[thisRow-1])) {
                return inMacro(lines, thisRow-1);
            } else {
                return false;
            }
        }

        var complements = {
            "<" : ">",
            ">" : "<",
            "{" : "}",
            "}" : "{",
            "[" : "]",
            "]" : "[",
            "(" : ")",
            ")" : "("
        };

        // Balance: we are balanced when the number of 'left' parentheses
        // is greater than or equal to the number of 'right' parentheses
        var findMatchingBracketRow = function(str, lines, row, balance) {
            
            if (typeof row === "undefined") return -1;
            if (row < 0) return -1;

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

        var indent = this.$getIndent(line);
        var unindent = indent.substr(1, indent.length - tab.length);
        var lines = this.$doc.$lines;

        var lastLine;
        if (row > 0)
            lastLine = this.$doc.$lines[row - 1];
        else
            lastLine = "";

        var tokenizedLine = this.$tokenizer.getLineTokens(line, state);
        var tokens = tokenizedLine.tokens;
        var endState = tokenizedLine.state;
        var nTokens = tokens.length;

        // Decisions made should not depend on trailing comments in the line
        // So, we strip those out for the purposes of indentation
        var lineCommentMatch = line.match(/\/\//);
        if (lineCommentMatch) {
            line = line.substr(0, lineCommentMatch.index - 1);
        }

        var lastLineCommentMatch = lastLine.match(/\/\//);
        if (lastLineCommentMatch) {
            lastLine = lastLine.substr(0, lastLineCommentMatch.index - 1);
        }

        // Get the caret position, if available
        // Decisions made should depend on text up to the caret point
        try {
            var caretPosition = window.editor.getCursorPosition();
            line = line.substr(0, caretPosition.column);
        } catch(err) {}

        // Comment specific behaviors
        if (state == "comment" || state == "rd-start") {

            // Handle a beginning of a comment
            // TODO: The rules for starting an R block, e.g. within
            // "/*** R", likely would have to be modified here.
            if (/\/\*/.test(line)) {
                return indent + ' * ';
            }

            // Allow users to have text further indented in a comment block
            if (/\s*\*+\s*(\w)/.test(line)) {
                var firstCharMatch = /\w/.exec(line); // to get the first match
                if (firstCharMatch) {
                    var firstStar = /\*/.exec(line);
                    return indent + '*' + Array(firstCharMatch.index - firstStar.index).join(' ');
                } else {
                    return indent + '* ';
                }
                
            }
            
            // default behavior -- doxygen style
            return indent.substr(0, indent.length-1) + ' * ';

        }

        // Rules for the 'general' state
        if (state == "start") {

            // Indent after a #define with continuation
            if (line.match(/#define.*\\/)) {
                return indent + tab;
            }

            // Unindent after leaving a #define with continuation
            if (inMacro(lines, row)) {
                var match = line.match(/\\/);
                if (!match) {
                    return unindent;
                } else {
                    line = line.substr(0, match.index);
                }
            }

            // Only indent on an ending '>' if we're not in a template
            // We can do this by checking for a matching '>'
            if (line.match(/>$/)) {
                var loc = findMatchingBracketRow(">", lines, row, 0);
                if (loc >= 0) {
                    return indent;
                } else {
                    return indent + tab;
                }
            }

            // Vertical alignment
            // We need to handle vertical alignment for two scenarios:
            // One, for multi-line function declarations, so that e.g.
            //
            // void foo(int a, int b, 
            //
            //          ^
            //
            // and two, for cases where we have multiple objects. Maybe
            // this can just be specialized for {.
            // static object foo {
            //      {foo, bar},
            //
            //      ^
            //
            if (line.match(/,\s*$/)) {

                // get the associated brace position
                var bracePos = line.match(/[[{(]/);
                if (bracePos) {
                    var firstCharAfter = line.substr(bracePos.index).match(/([^\s])/);
                    var idx = firstCharAfter.index;
                    if (firstCharAfter[1] == "(" || firstCharAfter[1] == "[") {
                        idx += 1;
                    }
                    return Array(idx + bracePos.index + 1).join(" ");
                } else {
                    return indent;
                }
            }

            // Unindent after leaving a block comment
            if (line.match(/\*\/\s*$/)) {
                return indent.substr(1, indent.length-1);
            }

            // Indent for case:, private:, public:, protected:
            if (line.match(/case\s+\w+:\s*$/) ||
                line.match(/public:\s*$/) ||
                line.match(/protected:\s*$/) ||
                line.match(/private:\s*$/)) {
                return indent + tab;
            }

            // Unindent after leaving a naked case
            if (lastLine.match(/case\s+\w+:\s*$/)) {
                return unindent;
            }

            // Don't indent for namespaces
            if (line.match(/namespace .*\{\s*$/) ||
                line.match(/switch .*\{\s*$/)) {
                return indent;
            }

            // Indent if the line ends on an operator token
            // Can't include > here since they may be used
            // for templates (it's handled above)
            if (line.match(/[\+\-\/\*\|\<\&\^\%\=]\s*$/)) {
                return indent + tab;
            }

            // Indent a naked else
            if (line.match(/else *$/)) {
                return indent + tab;
            }

            // Unindent after leaving a naked else
            if (lastLine.match(/else\s*$/)) {
                return unindent;
            }

            // Indent e.g. "if (foo)"
            if (line.match(/if.*\)\s*$/)) {
                return indent + tab;
            }

            // Unindent after leaving a naked if
            if (lastLine.match(/if.*\)\s*$/)) {
                return unindent;
            }

            // Tricky: indent if we're ending with a parenthesis
            // We have to walk up looking for the matching parenthesis,
            // since we assume that parenthesis will have the proper scope
            // or indentation
            var match = line.match(/([\)\}\]]);$/);
            if (match) {

                // this is needed because apparently 'row' is undefined
                // in the tester
                if (row) {
                    var rowMatch = findMatchingBracketRow(
                        match[1],
                        lines,
                        row,
                        0
                    );
                    
                    var startPos = lines[rowMatch].match(/([^\s])/).index + 1;
                    return Array(startPos).join(" ");
                }

            }

            // Same logic for function calls
            var match = line.match(/\)\s*\{\s*$/);
            if (match) {

                // Find the row for the associated opening paren
                if (row) {
                    var rowMatch = findMatchingBracketRow(
                        ")",
                        lines,
                        row,
                        0
                    );
                    var startPos = lines[rowMatch].match(/[^\s]/).index + 1;
                    return Array(startPos).join(" ") + tab;
                }
                
            }

            // Indent if we're ending with a parenthesis
            // Tricky: if we're defining a class with inheritance, we may
            // have something like
            //
            // class foo :
            //     public A {
            // 
            // }^ 
            //
            // We walk up through tokens, ignoring those within <>,
            // and look for something like foo (...):
            // If we see two
            if (line.match(/^.*[\{\(\[]\s*$/)) {
                return indent + tab;
            }

        } // start state rules

        return indent;
    };

    this.checkOutdent = function(state, line, input) {
        return this.$outdent.checkOutdent(state, line, input);
    };

    this.autoOutdent = function(state, doc, row) {
        this.$outdent.autoOutdent(doc, row);
    };

}).call(Mode.prototype);

exports.Mode = Mode;
});
