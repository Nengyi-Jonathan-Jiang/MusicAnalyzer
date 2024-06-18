import {Ref, RefObject} from "react";

type CanvasOptions = {
    useTransparency?: boolean,
    width?: number,
    height?: number
}

class CanvasBase {
    readonly #canvasRef: RefObject<HTMLCanvasElement>;
    #canvasElement: HTMLCanvasElement | null = null;
    #ctx: CanvasRenderingContext2D | null = null;

    readonly #useTransparency: boolean;

    #width: number = 300; // Default HTMLCanvasElement width
    #height: number = 150; // Default HTMLCanvasElement height
    #strokeColor: string = "black";
    #fillColor: string = "black";
    #clearColor: string = "transparent";
    #strokeWidth: number = 2;
    #font: string = "";
    #textAlign: TextAlignment = TextAlignment.Center;

    constructor(canvasElement: HTMLCanvasElement | RefObject<HTMLCanvasElement>, options?: CanvasOptions) {
        if (canvasElement instanceof HTMLCanvasElement) {
            this.#canvasRef = {current: canvasElement} as RefObject<HTMLCanvasElement>;
        } else this.#canvasRef = canvasElement;

        this.#useTransparency = options?.useTransparency ?? true;

        if(options?.width) this.width = options?.width;
        if(options?.height) this.height = options?.height;

        this.updateCanvas();
    }

    get width() {
        return this.#width;
    }

    set width(width: number) {
        this.#width = width;
        if (this.canvas) {
            this.canvas.width = width;
        }
    }

    get height() {
        return this.#height;
    }

    set height(height: number) {
        this.#height = height;
        if (this.canvas) {
            this.canvas.height = height;
        }
    }

    get canvas() {
        this.updateCanvas();
        return this.#canvasElement;
    }

    private updateCanvas() {
        if (this.#canvasRef.current !== this.#canvasElement) {
            if (this.#canvasRef.current !== null) {
                this.changeCanvasTo(this.#canvasRef.current);
            } else {
                this.#canvasElement = this.#ctx = null;
            }
        }
    }

    private changeCanvasTo(canvas: HTMLCanvasElement) {
        this.#canvasElement = canvas;
        this.#ctx = canvas.getContext('2d', {
            alpha: this.#useTransparency
        });

        canvas.width = this.#width;
        canvas.height = this.#height;

        if(!this.#ctx) return;

        this.#ctx.strokeStyle = this.#strokeColor;
        this.#ctx.fillStyle = this.#fillColor;
        this.#ctx.lineWidth = this.#strokeWidth;
        [this.#ctx.textBaseline, this.#ctx.textAlign] = this.#textAlign.split(' ') as [CanvasTextBaseline, CanvasTextAlign];
        this.#ctx.font = this.#font;
    }

    protected get ctx() {
        this.updateCanvas();
        return this.#ctx;
    }

    resizeToFitCSS() {
        if (this.canvas !== null) {
            this.width = this.canvas.clientWidth;
            this.height = this.canvas.clientHeight;
        }
    }

    set strokeColor(color: string) {
        this.#strokeColor = color;
        if (this.ctx) {
            this.ctx.strokeStyle = color;
        }
    }

    set fillColor(color: string) {
        this.#fillColor = color;
        if (this.ctx) {
            this.ctx.fillStyle = color;
        }
    }

    set clearColor(color: string) {
        this.#clearColor = color;
    }

    set strokeWidth(width: number) {
        this.#strokeWidth = width;
        if (this.ctx) {
            this.ctx.lineWidth = width;
        }
    }

    get strokeWidth() {
        return this.#strokeWidth;
    }

    set textAlignment(alignment: TextAlignment) {
        this.#textAlign = alignment;
        if(this.ctx) {
            [this.ctx.textBaseline, this.ctx.textAlign] = this.#textAlign.split(' ') as [CanvasTextBaseline, CanvasTextAlign];
        }
    }

    set font(font: string) {
        this.#font = font;
        if(this.ctx) {
            this.ctx.font = font;
        }
    }

    beginNewPath() {
        if (!this.ctx) return;
        this.ctx.beginPath();
    }

    closeCurrentSubPath() {
        if (!this.ctx) return;
        this.ctx.closePath();
    }

    beginSubPathAt(x: number, y: number) {
        if (!this.ctx) return;
        this.ctx.moveTo(x, y)
    }

    lineTo(x: number, y: number) {
        if (!this.ctx) return;
        this.ctx.lineTo(x, y);
    }

    arcTo(cornerX: number, cornerY: number, endX: number, endY: number, radius: number) {
        if (!this.ctx) return;
        this.ctx.arcTo(cornerX, cornerY, endX, endY, radius);
    }

    arc(x: number, y: number, r: number, a1: number, a2: number, counterclockwise = false) {
        if (!this.ctx) return;
        this.ctx.arc(x, y, r, a1, a2, counterclockwise)
    }

    stroke() {
        if (!this.ctx) return;
        this.ctx.stroke();
    }

    fill() {
        if (!this.ctx) return;
        this.ctx.fill();
    }

    clear() {
        if (!this.ctx) return;

        this.ctx.save();
        this.ctx.resetTransform();
        this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

        if (this.#clearColor !== "transparent") {
            this.ctx.fillStyle = this.#clearColor;
            this.ctx.fillRect(0, 0, this.width, this.height);
        }

        this.ctx.restore();
    }


    drawImage(img: HTMLImageElement | HTMLCanvasElement, x: number, y: number) {
        if (!this.ctx || img.width * img.height == 0) return;
        this.ctx.drawImage(img, x, y)
    }

    drawImageOnRect(img: HTMLImageElement | HTMLCanvasElement, x1: number, y1: number, x2: number, y2: number) {
        if (!this.ctx || img.width * img.height == 0) return;

        let destwidth = ~~(x2 - x1);
        let destheight = ~~(y2 - y1);

        this.ctx.drawImage(img, x1, y1, destwidth, destheight)
    }

    pushState() {
        if (!this.ctx) return;
        this.ctx.save();
    }

    restoreState() {
        if (!this.ctx) return;
        this.ctx.restore()
    }

    rotate(angle: number, ) {
        if (!this.ctx) return;
        this.ctx.rotate(angle);
    }

    translate(x: number, y: number) {
        if (!this.ctx) return;
        this.ctx.translate(x, y)
    }

    rotateAroundPoint(angle: number, x: number, y: number) {
        this.translate(-x, -y);
        this.rotate(angle);
        this.translate(x, y);
    }
}

export class Canvas extends CanvasBase {
    line(x1: number, y1: number, x2: number, y2: number) {
        this.beginSubPathAt(x1, y1);
        this.lineTo(x2, y2);
    }

    immediateLine(x1: number, y1: number, x2: number, y2: number) {
        this.beginNewPath();
        this.line(x1, y1, x2, y2);
        this.stroke();
        this.closeCurrentSubPath();
    }

    rect(x1: number, y1: number, width: number, height: number) {
        if (!this.ctx) return;
        this.ctx.rect(x1, y1, width, height);
    }

    immediateFillRect(x1: number, y1: number, width: number, height: number) {
        if (!this.ctx) return;
        this.ctx.fillRect(x1, y1, width, height);
    }

    immediateStrokeRect(x1: number, y1: number, width: number, height: number) {
        if (!this.ctx) return;
        this.ctx.strokeRect(x1, y1, width, height);
    }

    circle(centerX: number, centerY: number, radius: number) {
        this.arc(centerX, centerY, radius, 0, Math.PI * 2);
    }

    immediateFillCircle(centerX: number, centerY: number, radius: number) {
        this.beginNewPath();
        this.circle(centerX, centerY, radius);
        this.fill();
    }

    immediateStrokeCircle(centerX: number, centerY: number, radius: number, adjustForLineWidth: boolean = false) {
        if (adjustForLineWidth) {
            radius -= this.strokeWidth;
        }

        this.beginNewPath();
        this.circle(centerX, centerY, radius);
        this.stroke();
    }

    immediateFillArc(centerX: number, centerY: number, radius: number, angle1: number, angle2: number, counterclockwise = false) {
        this.beginNewPath();
        this.arc(centerX, centerY, radius, angle1, angle2, counterclockwise);
        this.fill();
    }

    immediateStrokeArc(centerX: number, centerY: number, radius: number, angle1: number, angle2: number, counterclockwise = false) {
        this.beginNewPath();
        this.arc(centerX, centerY, radius, angle1, angle2, counterclockwise);
        this.stroke();
    }

    immediateFillText(txt: string, x: number, y: number) {
        if (!this.ctx) return;

        this.beginNewPath();
        this.ctx.fillText(txt, x, y);
        this.closeCurrentSubPath();
    }

    immediateStrokeText(txt: string, x: number, y: number) {
        if (!this.ctx) return;

        this.beginNewPath();
        this.ctx.strokeText(txt, x, y);
        this.closeCurrentSubPath();
    }

    polygon(center: [number, number], ...pointOffsets: [number, number][]) {
        this.beginSubPathAt(
            pointOffsets[pointOffsets.length - 1][0] + center[0],
            pointOffsets[pointOffsets.length - 1][1] + center[1]
        );

        pointOffsets.forEach(
            s => this.lineTo(s[0] + center[0], s[1] + center[1])
        );
    }

    immediateDrawPolygon(center: [number, number], ...pointOffsets: [number, number][]) {
        this.beginNewPath();
        this.polygon(center, ...pointOffsets);
        this.stroke();
    }

    immediateFillPolygon(center: [number, number], ...pointOffsets: [number, number][]) {
        this.beginNewPath();
        this.polygon(center, ...pointOffsets);
        this.stroke();
    }

    roundedRect(x: number, y: number, width: number, height: number, radius: number) {
        const x1 = x, x2 = x + radius, x3 = x + width - radius, x4 = x + width;
        const y1 = y, y2 = y + radius, y3 = y + height - radius, y4 = y + height;

        /*
         * Corner order:
         *      x1 x2 x3 x4
         *
         * y1   +--2--3--+
         * y2   1        4
         * y3   8        5
         * y4   +--7--6--+
         */

        this.beginSubPathAt(x1, y2);
        this.arcTo(x1, y1, x2, y1, radius);
        this.lineTo(x3, y1);
        this.arcTo(x4, y1, x4, y2, radius);
        this.lineTo(x4, y3);
        this.arcTo(x4, y4, x3, y4, radius);
        this.lineTo(x2, y4);
        this.arcTo(x1, y4, x1, y3, radius);
        this.closeCurrentSubPath();
    }

    immediateStrokeRoundedRect(x: number, y: number, width: number, height: number, radius: number) {
        this.beginNewPath();
        this.roundedRect(x, y, width, height, radius);
        this.stroke();
    }

    immediateFillRoundedRect(x: number, y: number, width: number, height: number, radius: number) {
        this.beginNewPath();
        this.roundedRect(x, y, width, height, radius);
        this.fill();
    }

    /**
     * Strokes a curve through 2 or more points
     * @param points
     * points to draw the curve through
     */
    spline(...points: [number, number][]) {
        if (!this.ctx) return;

        const f = 0.3, t = 0.6;

        this.beginSubPathAt(points[0][0], points[0][1]);
        let m = 0,
            lastDx = 0, lastDy = 0,
            currDx = 0, currDy = 0;

        let previousPoint = points[0];

        for (let i = 1; i < points.length; i++) {
            const currentPoint = points[i];

            const nextPoint = points[i + 1];

            if (nextPoint) {
                m = (previousPoint[1] - currentPoint[1]) / (previousPoint[0] - currentPoint[0]);
                currDx = -(nextPoint[0] - currentPoint[0]) * f;
                currDy = currDx * m * t
            }

            this.ctx.bezierCurveTo(
                previousPoint[0] - lastDx,
                previousPoint[1] - lastDy,
                currentPoint[0] + currDx,
                currentPoint[1] + currDy,
                currentPoint[0],
                currentPoint[1]
            );

            lastDx = currDx;
            lastDy = currDy;

            previousPoint = currentPoint
        }
    }

    immediateStrokeSpline(...points: [number, number][]) {
        this.beginNewPath();
        this.spline(...points);
        this.stroke();
    }

    closedSpline(...points: [number, number][]) {
        this.spline(...points, points[0]);
    }

    immediateStrokeClosedSpline(...points: [number, number][]) {
        this.beginNewPath();
        this.closedSpline(...points);
        this.stroke();
    }

    immediateFillClosedSpline(...points: [number, number][]) {
        this.beginNewPath();
        this.closedSpline(...points);
        this.fill();
    }

    drawScaledImage(img: HTMLImageElement | HTMLCanvasElement, x: number, y: number, factor = 1) {
        this.drawImageOnRect(img, x, y, factor * img.width, factor * img.height)
    }
}

export enum TextAlignment {
    TopLeft = "top left", TopCenter = "top center", TopRight = "top right",
    CenterLeft = "middle left", Center = "middle center", CenterRight = "middle right",
    BottomLeft = "alphabetic left", BottomCenter = "alphabetic center", BottomRight = "alphabetic right"
}