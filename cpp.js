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
    var MatchingBraceOutdent = require("ace/mode/matching_brace_outdent").MatchingBraceOutdent;
    var Range = require("ace/range").Range;
    var CstyleBehaviour = require("ace/mode/behaviour/cstyle").CstyleBehaviour;
    var CStyleFoldMode = require("ace/mode/folding/cstyle").FoldMode;
    
    var Mode = function(suppressHighlighting, doc, session) {
        this.$tokenizer = new Tokenizer(new c_cppHighlightRules().getRules());
        this.$outdent = new MatchingBraceOutdent();
        this.$behaviour = new CstyleBehaviour();
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

        var indent = this.$getIndent(line);
        var unindent = indent.substr(1, indent.length - tab.length);

        var lastLine;
        if (row > 0)
            lastLine = this.$doc.$lines[row - 1];
        else
            lastLine = "";

        var tokenizedLine = this.$tokenizer.getLineTokens(line, state);
        var tokens = tokenizedLine.tokens;
        var endState = tokenizedLine.state;
        var nTokens = tokens.length;

        // Take line to just be the characters to the left of the caret
        // 

        if (true) {
            console.log(state);
            // console.log(this);
        }

        // if (tokens.length && tokens[tokens.length-1].type == "comment") {
        //     return indent;
        // }

        // Comment specific behaviors
        if (state == "comment" || state == "rd-start") {

            // Default to a continuation
            return indent.substr(1, indent.length-1) + " * ";

        }

        // Rules for the 'general' state
        if (state == "start") {

            // Unindent after leaving a block comment
            if (line.match(/\*\/\s*$/)) {
                return indent.substr(1, indent.length-1);
            }

            // If we end with a ':', we can indent
            if (line.match(/:\s*$/)) {
                return indent + tab;
            }

            // Unindent after leaving a naked case
            if (lastLine.match(/case\s+\w+:\s*$/)) {
                return unindent;
            }

            // Don't indent if we're defining a class or a namespace
            if (line.match(/struct .*\{\s*$/) ||
                line.match(/class .*\{\s*$/) ||
                line.match(/namespace .*\{\s*$/) ||
                line.match(/switch .*\{\s*$/)) {
                return indent;
            }

            // Indenting for functions that have trailing comments
            if (line.match(/\) *\{ *\/\//)) {
                return indent + tab;
            }

            // Indent if the line ends on an operator token
            if (line.match(/[+-/*<>|&^%=]\s*$/)) {
                return indent + tab;
            }

            // Indent a naked else
            if (line.match(/else *$/)) {
                return indent + tab;
            }

            // Unindent after leaving a naked else
            if (lastLine.match(/else *$/)) {
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

            // Indent if we're ending with a parenthesis
            if (line.match(/^.*[\{\(\[]\s*$/)) {
                return indent + tab;
            }

        } // start state rules
        
        if (state == "start") {
            var match = line.match(/^.*[\{\(\[]\s*$/);
            if (match) {
                indent += tab;
            }
        } else if (state == "doc-start") {
            if (endState == "start") {
                return "";
            }
            var match = line.match(/^\s*(\/?)\*/);
            if (match) {
                if (match[1]) {
                    indent += " ";
                }
                indent += "* ";
            }
        }

        return indent;
    };

    this.checkOutdent = function(state, line, input) {
        return this.$outdent.checkOutdent(line, input);
    };

    this.autoOutdent = function(state, doc, row) {
        this.$outdent.autoOutdent(doc, row);
    };

}).call(Mode.prototype);

exports.Mode = Mode;
});
