import { Pipe, PipeTransform } from '@angular/core';

/**
 * Renders a message payload that parses as valid JSON in an indented, human-readable form.
 * A payload that fails to parse as JSON renders unchanged, without throwing — per
 * ui-presentation: "JSON Payload Pretty-Print Rendering".
 */
@Pipe({ name: 'jsonPretty', standalone: true, pure: true })
export class JsonPrettyPipe implements PipeTransform {
  transform(value: string): string {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
}
