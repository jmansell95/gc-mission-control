export function createPageUrl(pageName: string) {
    return '/' + pageName.replace(/ /g, '-');
}

/**
 * Sort an array of objects alphabetically by a label key (case-insensitive).
 * Returns a new array; does not mutate the input. Use for dropdown <option>
 * lists so entities (Staff, Jobs, Teams, Vehicles, etc.) always render A–Z.
 */
export function sortAZ<T>(arr: T[], labelKey: keyof T): T[] {
    return [...arr].sort((a, b) => {
        const av = (a[labelKey] ?? '') as unknown as string;
        const bv = (b[labelKey] ?? '') as unknown as string;
        return String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' });
    });
}