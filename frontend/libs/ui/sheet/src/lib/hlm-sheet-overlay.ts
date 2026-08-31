import { Directive, computed, effect, input, untracked } from '@angular/core';
import { injectCustomClassSettable } from '@spartan-ng/brain/core';
import { BrnSheetOverlay } from '@spartan-ng/brain/sheet';
import { hlm } from '@spartan-ng/helm/utils';
import type { ClassValue } from 'clsx';

export const hlmSheetOverlayClass = hlm('fixed inset-0 z-50 bg-black/50 supports-backdrop-filter:backdrop-blur-xs');

@Directive({
	selector: '[hlmSheetOverlay],hlm-sheet-overlay',
	hostDirectives: [BrnSheetOverlay],
})
export class HlmSheetOverlay {
	private readonly _classSettable = injectCustomClassSettable({ optional: true, host: true });
	public readonly userClass = input<ClassValue>('', { alias: 'class' });
	protected readonly _computedClass = computed(() => hlm(hlmSheetOverlayClass, this.userClass()));

	constructor() {
		effect(() => {
			const classValue = this._computedClass();
			untracked(() => this._classSettable?.setClassToCustomElement(classValue));
		});
	}
}
