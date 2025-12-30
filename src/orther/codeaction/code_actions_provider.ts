/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';
import { getMarkdownImageFromLine, imageToBase64 } from './image_to_base64_util';
import { getConfig } from '../../config/configuration';

export function registerCodeActionCommand(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand('extension.codeaction.toogleTaskList', () => toogleTaskList()),
	);
}

async function toogleTaskList(): Promise<vscode.CodeAction | undefined> {
	const editor = vscode.window.activeTextEditor
	if (!editor) {
		return undefined
	}
	const document = editor.document;
	const range = editor.selection;
	const lineContent = editor.document.lineAt(range.start).text;
	const isTaskList = /(^\s*-\s+\[[ xX]?\]\s)/.test(lineContent);
	if (!isTaskList) {
		return
	}
	const isTaskOnStatus = /(^\s*-\s+\[[xX]\]\s)/.test(lineContent);
	let content = lineContent;
	if (isTaskOnStatus) {
		content = content.replace(/(-\s+\[[ xX]?\]\s)/, "- [ ] ")
	} else {
		content = content.replace(/(-\s+\[[ xX]?\]\s)/, "- [x] ")
	}
	await editor.edit((editBuilder: vscode.TextEditorEdit) => {
		editBuilder.replace(new vscode.Range(new vscode.Position(range.start.line, 0), new vscode.Position(range.start.line, document.lineAt(range.start.line).text.length)), content)
	});
}

/**
 * Provides code actions for converting base64 code to ![][image-id] and append base64 code to text's last line.
 */
export class CodeActionsProvider implements vscode.CodeActionProvider {

	public static readonly providedCodeActionKinds = [
		vscode.CodeActionKind.QuickFix,
	];

	// 返回Quick Fix
	public async provideCodeActions(document: vscode.TextDocument, range: vscode.Range): Promise<vscode.CodeAction[] | undefined> {
		const codeActions: vscode.CodeAction[] = [];
		const start = range.start;
		const lineContent = document.lineAt(start.line);
		console.log(`provideCodeActions, content: ${lineContent}`)

		const toogleTaskList = await this.toogleTaskList(lineContent.text);
		if (toogleTaskList) {
			codeActions.unshift(toogleTaskList);
		}

		const imageAddrImageStyleToBase64ImageStyle = await this.imageAddrImageStyleToBase64ImageStyle(document, range, lineContent.text);
		if (imageAddrImageStyleToBase64ImageStyle) {
			codeActions.unshift(imageAddrImageStyleToBase64ImageStyle);
		}

		const base64ContentToBase64ImageStyle = await this.base64ContentToBase64ImageStyle(document, range, lineContent.text);
		if (base64ContentToBase64ImageStyle) {
			codeActions.unshift(base64ContentToBase64ImageStyle);
		}

		return codeActions;
	}

	async toogleTaskList(lineContent: string): Promise<vscode.CodeAction | undefined> {
		const isTaskList = /(^\s*-\s+\[[ xX]?\]\s)/.test(lineContent);
		if (!isTaskList) {
			return
		}
		const codeAction = new vscode.CodeAction(`Switch Task Status`, vscode.CodeActionKind.QuickFix);
		codeAction.command = {
			title: '',
			command: 'extension.codeaction.toogleTaskList',
			arguments: [],
		};
		codeAction.isPreferred = true;
		return codeAction;
	}

	/**
	 * input: ![](./image.png)
	 * output: ![](data:image/*;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAfAToDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD2ClopK3OQWiiigApKKWmMSlopKACilooAKSlpKQC0UUlABS0UlABS0UlABRRSUDFpKWkoAWikpaAEpaKSgBaKSjFAC0lLSUAFFLSUwClopKAFooooAKSiloASjPvS0mPagBaWkopEi0lLSUALRRRTGFJSikoAWiikoAWijrSdqQC0lFLQAUlFLQAlLSUtACUUdKKBiUtJS0AJRS0lABS0lLQAUnelpKAFpKWjtQAUlFFMApaSigBaSlpKAFooooAKT8KUUmfagD//2Q==)
	 */
	/**
	 * input: ![](./image.png)
	 * output: ![](data:image/*;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAfAToDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD2ClopK3OQWiiigApKKWmMSlopKACilooAKSlpKQC0UUlABS0UlABS0UlABRRSUDFpKWkoAWikpaAEpaKSgBaKSjFAC0lLSUAFFLSUwClopKAFooooAKSiloASjPvS0mPagBaWkopEi0lLSUALRRRTGFJSikoAWiikoAWijrSdqQC0lFLQAUlFLQAlLSUtACUUdKKBiUtJS0AJRS0lABS0lLQAUnelpKAFpKWjtQAUlFFMApaSigBaSlpKAFooooAKT8KUUmfagD//2Q==)
	 */
	async imageAddrImageStyleToBase64ImageStyle(document: vscode.TextDocument, range: vscode.Range, lineContent: string): Promise<vscode.CodeAction | undefined> {
		if (lineContent === undefined || lineContent === '') {
			return undefined;
		}
		const localImage = getMarkdownImageFromLine(lineContent);
		console.log(`localImage, content: ${lineContent} --> (${localImage?.alt}, ${localImage?.url})`)
		if (localImage?.url === undefined) {
			return undefined;
		}
		const imageWidth = getConfig('builtin.markdown.maxWidthOfImageToBase64', 0);

		const base64 = await imageToBase64(localImage?.url, imageWidth)
		if (base64 === undefined) {
			return undefined;
		}

		const fix = new vscode.CodeAction(`Convert Image Path To Base64`, vscode.CodeActionKind.QuickFix);
		fix.edit = new vscode.WorkspaceEdit();
		console.log("start ", range.start);
		console.log("end ", range.end);
		const time_id = Date.now().toString();
		console.log(time_id);
		const image_id = `![${localImage?.alt}](${base64})`;
		fix.edit.replace(document.uri, new vscode.Range(new vscode.Position(range.start.line, 0), new vscode.Position(range.start.line, document.lineAt(range.start.line).text.length)), image_id);
		fix.isPreferred = true;
		return fix;
	}


	/**
	 * input: data:image/*;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAfAToDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD2ClopK3OQWiiigApKKWmMSlopKACilooAKSlpKQC0UUlABS0UlABS0UlABRRSUDFpKWkoAWikpaAEpaKSgBaKSjFAC0lLSUAFFLSUwClopKAFooooAKSiloASjPvS0mPagBaWkopEi0lLSUALRRRTGFJSikoAWiikoAWijrSdqQC0lFLQAUlFLQAlLSUtACUUdKKBiUtJS0AJRS0lABS0lLQAUnelpKAFpKWjtQAUlFFMApaSigBaSlpKAFooooAKT8KUUmfagD//2Q==
	 * output: ![](data:image/*;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAfAToDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD2ClopK3OQWiiigApKKWmMSlopKACilooAKSlpKQC0UUlABS0UlABS0UlABRRSUDFpKWkoAWikpaAEpaKSgBaKSjFAC0lLSUAFFLSUwClopKAFooooAKSiloASjPvS0mPagBaWkopEi0lLSUALRRRTGFJSikoAWiikoAWijrSdqQC0lFLQAUlFLQAlLSUtACUUdKKBiUtJS0AJRS0lABS0lLQAUnelpKAFpKWjtQAUlFFMApaSigBaSlpKAFooooAKT8KUUmfagD//2Q==)
	 */
	async base64ContentToBase64ImageStyle(document: vscode.TextDocument, range: vscode.Range, lineContent: string): Promise<vscode.CodeAction | undefined> {
		const checkoutString = lineContent.slice(0, 30)
		const isAtStartOfSmiley = checkoutString.startsWith('data:image/') && checkoutString.indexOf(';base64,') > -1
		if (!isAtStartOfSmiley) {
			return
		}
		const fix = new vscode.CodeAction(`Convert Image Block`, vscode.CodeActionKind.QuickFix);
		fix.edit = new vscode.WorkspaceEdit();
		console.log("start ", range.start);
		console.log("end ", range.end);
		const time_id = Date.now().toString();
		console.log(time_id);
		const image_id = `![](${lineContent})`;
		fix.edit.replace(document.uri, new vscode.Range(new vscode.Position(range.start.line, 0), new vscode.Position(range.start.line, document.lineAt(range.start.line).text.length)), image_id);
		fix.isPreferred = true;
		return fix;
	}

	dispose() {

	}
}

export function registerCodeActionsProvider(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.languages.registerCodeActionsProvider('markdown', new CodeActionsProvider(), {
		providedCodeActionKinds: CodeActionsProvider.providedCodeActionKinds
	}));
}
