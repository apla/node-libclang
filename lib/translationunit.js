// Copyright 2013 Timothy J Fontaine <tjfontaine@gmail.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the 'Software'), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE

var ref = require('ref');

var lib = require('./dynamic_clang').libclang;

var Cursor = require('./cursor');

var TranslationUnit = function (instance) {
  if (!(this instanceof TranslationUnit))
    return new TranslationUnit(instance);

  var self = this;

  if (instance instanceof Buffer) {
    this._instance = instance;
  }

  Object.defineProperty(this, 'cursor', {
    get: function () {
      var t = lib.clang_getTranslationUnitCursor(self._instance); 
      return new Cursor(t);
    },
  });
};

TranslationUnit.fromSource = function (index, file, args) {
  var cargs, i, inst;

  cargs = new Buffer(ref.sizeof.pointer * args.length);

  for (i = 0; i < args.length; i++) {
    cargs.writePointer(ref.allocCString(args[i]),
      i * ref.sizeof.pointer);
  }

  inst = lib.clang_createTranslationUnitFromSourceFile(
    index._instance, file, args.length, cargs, 0, null);

  return new TranslationUnit(inst);
};

TranslationUnit.parse = function (index, file, args, files, flags) {
	var cargs, i, inst;

	cargs = new Buffer(ref.sizeof.pointer * args.length);

	for (i = 0; i < args.length; i++) {
		cargs.writePointer(ref.allocCString(args[i]),
						   i * ref.sizeof.pointer);
	}

	// http://clang.llvm.org/doxygen/group__CINDEX__TRANSLATION__UNIT.html
	// TODO: how I can pass enums to the ffi?
	var cflags = 0;
	if (flags) {
		if (flags.incomplete) {
			cflags = cflags || 2;
		}
		if (flags.precompiledPreable) {
			cflags = cflags || 4;
		}
	}

	console.log (cflags, cflags === 6 ? '': "flags doesn't match");

	inst = lib.clang_parseTranslationUnit(
		index._instance,
		file,
		cargs, args.length, // arguments
		null, 0, // unsavedFiles
		cflags// flags
	);

	return new TranslationUnit(inst);
};


var CompletionAvailability = ['available', 'deprecated', 'not available', 'not accessible'];
var CompletionChunkSpelling = ["Optional", "TypedText", "Text", "Placeholder", "Informative", "CurrentParameter", "LeftParen", "RightParen", "LeftBracket", "RightBracket", "LeftBrace", "RightBrace", "LeftAngle", "RightAngle", "Comma", "ResultType", "Colon", "SemiColon", "Equal", "HorizontalSpace", "VerticalSpace", "Unknown"];

TranslationUnit.prototype.codeCompleteAt = function (fileName, lineNo, columnNo, raw) {

	var codeCompletionOptions = lib.clang_defaultCodeCompleteOptions ();

	var cComplResultsRef = lib.clang_codeCompleteAt (
		this._instance,
		fileName,
		lineNo,
		columnNo,
		null, 0, codeCompletionOptions
	);

	// TODO: check for NULL
	var cComplRes = cComplResultsRef.deref();

	console.log ('completion result count: ', cComplRes.NumResults);

	var results = cComplRes.Results;
	if (cComplRes.NumResults > 0) {

		if (!('CompletionString' in results.type.fields)) {
			console.log ('wrong data, no CompletionString in type definition');
		}

		var CompletionArray = ArrayType (d.CXCompletionResult);
		var completions = new CompletionArray (cComplRes.Results, cComplRes.NumResults);

		var complList = [];

		for (var complIdx = 0; complIdx < completions.length; complIdx ++) {
			var completion = completions[complIdx];
			var complData = {};
			complList.push (complData);

			var compString = completion.CompletionString;

			var availability = lib.clang_getCompletionAvailability (compString);

//			console.log ('Availability:', CompletionAvailability[availability]);
			complData['availability'] = raw ? availability : CompletionAvailability[availability];

			var priority = lib.clang_getCompletionPriority (compString);
//			console.log ('Priority:', priority);
			complData['priority'] = priority;

			var comment = util.toString(lib.clang_getCompletionBriefComment (compString));
//			console.log ('Comment:', comment);
			complData['comment'] = comment;

			var numChunks = lib.clang_getNumCompletionChunks (compString);
//			console.log ("NumChunks:", numChunks);
			var chunks = [];
			for (var chunkIdx = 0; chunkIdx < numChunks; chunkIdx++) {
				var chunkText = util.toString(lib.clang_getCompletionChunkText (compString, chunkIdx));
				chunks.push (chunkText);
				var chunkKind = lib.clang_getCompletionChunkKind(compString, chunkIdx);
				chunks.push (raw ? chunkKind : CompletionChunkSpelling[chunkKind]);
//				// TODO: check child chunks when CXCompletionChunk_Optional
//				// CXCompletionString child = clang_getCompletionChunkCompletionString(compString);
			}
//			console.log ('Chunks:', chunks);
			complData['chunks'] = chunks;
			console.log (JSON.stringify (complData));
		}
	}

	lib.clang_disposeCodeCompleteResults(cComplResultsRef);

	return;

	console.log (cComplRes);
}
module.exports = TranslationUnit;
