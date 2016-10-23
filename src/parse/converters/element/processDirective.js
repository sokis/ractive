import { DECORATOR, TRANSITION, EVENT } from '../../../config/types';
import Parser from '../../Parser';
import readExpression from '../readExpression';
import flattenExpression from '../../utils/flattenExpression';
import parseJSON from '../../../utils/parseJSON';
import { warnIfDebug } from '../../../utils/log';

var methodCallPattern = /^([a-zA-Z_$][a-zA-Z_$0-9]*)\(.*\)\s*$/,
	ExpressionParser;

ExpressionParser = Parser.extend({
	converters: [ readExpression ]
});

// TODO clean this up, it's shocking
export default function processDirective ( tokens, parentParser, type ) {
	var result,
		match,
		token,
		colonIndex,
		directiveName,
		directiveArgs,
		parsed;

	if ( typeof tokens === 'string' ) {
		const pos = parentParser.pos - tokens.length;
		if ( type === DECORATOR || type === TRANSITION ) {
			const parser = new ExpressionParser( `[${tokens}]` );
			return { a: flattenExpression( parser.result[0] ) };
		}

		if ( type === EVENT && ( match = methodCallPattern.exec( tokens ) ) ) {
			warnIfDebug( parentParser.getContextMessage( pos, `Unqualified method events are deprecated. Prefix methods with '@this.' to call methods on the current Ractive instance.` )[2] );
			tokens = `@this.${match[1]}${tokens.substr(match[1].length)}`;
		}

		if ( type === EVENT && ~tokens.indexOf( '(' ) ) {
			const parser = new ExpressionParser( '[' + tokens + ']' );
			if ( parser.result && parser.result[0] ) {
				if ( parser.remaining().length ) {
					parentParser.pos = pos + tokens.length - parser.remaining().length;
					parentParser.error( `Invalid input after event expression '${parser.remaining()}'` );
				}
				return { x: flattenExpression( parser.result[0] ) };
			}

			if ( tokens.indexOf( ':' ) > tokens.indexOf( '(' ) || !~tokens.indexOf( ':' ) ) {
				parentParser.pos = pos;
				parentParser.error( `Invalid input in event expression '${tokens}'` );
			}

		}

		if ( tokens.indexOf( ':' ) === -1 ) {
			return tokens.trim();
		}

		tokens = [ tokens ];
	}

	result = {};

	directiveName = [];
	directiveArgs = [];

	if ( tokens ) {
		while ( tokens.length ) {
			token = tokens.shift();

			if ( typeof token === 'string' ) {
				colonIndex = token.indexOf( ':' );

				if ( colonIndex === -1 ) {
					directiveName.push( token );
				} else {
					// is the colon the first character?
					if ( colonIndex ) {
						// no
						directiveName.push( token.substr( 0, colonIndex ) );
					}

					// if there is anything after the colon in this token, treat
					// it as the first token of the directiveArgs fragment
					if ( token.length > colonIndex + 1 ) {
						directiveArgs[0] = token.substring( colonIndex + 1 );
					}

					break;
				}
			}

			else {
				directiveName.push( token );
			}
		}

		directiveArgs = directiveArgs.concat( tokens );
	}

	if ( !directiveName.length ) {
		result = '';
	} else if ( directiveArgs.length || typeof directiveName !== 'string' ) {
		result = {
			// TODO is this really necessary? just use the array
			n: ( directiveName.length === 1 && typeof directiveName[0] === 'string' ? directiveName[0] : directiveName )
		};

		if ( directiveArgs.length === 1 && typeof directiveArgs[0] === 'string' ) {
			parsed = parseJSON( '[' + directiveArgs[0] + ']' );
			result.a = parsed ? parsed.value : [ directiveArgs[0].trim() ];
		}

		else {
			result.d = directiveArgs;
		}
	} else {
		result = directiveName;
	}

	if ( directiveArgs.length && type ) {
		warnIfDebug( parentParser.getContextMessage( parentParser.pos, `Proxy events with arguments are deprecated. You can fire events with arguments using "@this.fire('eventName', arg1, arg2, ...)".` )[2] );
	}

	return result;
}
