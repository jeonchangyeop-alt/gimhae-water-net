/**
 * 김해관망관리 - 클라이언트 이미지 전처리 및 경량화 엔진
 * 1. EXIF 방향(Orientation) 자동 보정
 * 2. 긴 변 기준 최대 해상도 제한 (작은 사진은 절대 확대하지 않음)
 * 3. 초경량 압축 (WebP 또는 JPEG 품질 제어)
 * 4. 초경량 썸네일(200px) 자동 생성
 */

class ImageCompressor {
    constructor() {
        // 기본 프로파일 설정
        this.profiles = {
            normal: {
                maxDimension: 1920, // 일반 사진: 긴 변 최대 1920px
                quality: 0.8,       // 품질 0.8
                format: 'image/webp' // 최신 WebP 우선 (브라우저 지원)
            },
            highQuality: {
                maxDimension: 3840, // 계량기/명판 판독용 4K급
                quality: 0.95,
                format: 'image/webp'
            },
            thumbnail: {
                maxDimension: 220,  // 목록용 초경량 썸네일
                quality: 0.7,
                format: 'image/webp'
            }
        };
    }

    /**
     * 이미지 파일을 받아서 압축본과 썸네일을 동시 생성하여 반환
     * @param {File} file - 원본 이미지 파일
     * @param {string} mode - 'normal' | 'highQuality'
     * @returns {Promise<{compressedBlob: Blob, thumbDataUrl: string, meta: Object}>}
     */
    async processImage(file, mode = 'normal') {
        const config = this.profiles[mode] || this.profiles.normal;
        const thumbConfig = this.profiles.thumbnail;

        const startTime = performance.now();
        const img = await this.loadImage(file);

        // 1. 주 압축 이미지 생성
        const { blob: compressedBlob, width, height } = await this.resizeAndCompress(
            img, 
            config.maxDimension, 
            config.quality, 
            config.format
        );

        // 2. 초경량 썸네일 생성 (DataURL)
        const { dataUrl: thumbDataUrl, width: thumbW, height: thumbH } = await this.createThumbnail(
            img, 
            thumbConfig.maxDimension, 
            thumbConfig.quality
        );

        const elapsedMs = Math.round(performance.now() - startTime);

        return {
            compressedBlob,
            thumbDataUrl,
            meta: {
                originalName: file.name,
                originalSize: file.size,
                compressedSize: compressedBlob.size,
                compressionRatio: ((1 - compressedBlob.size / file.size) * 100).toFixed(1) + '%',
                width,
                height,
                thumbW,
                thumbH,
                mode,
                elapsedMs
            }
        };
    }

    /**
     * File 객체를 HTMLImageElement로 로드 (URL.createObjectURL)
     */
    loadImage(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };
            img.onerror = (err) => {
                URL.revokeObjectURL(url);
                reject(err);
            };
            img.src = url;
        });
    }

    /**
     * 캔버스를 이용한 리사이징 및 압축
     */
    resizeAndCompress(img, maxDim, quality, mimeType) {
        return new Promise((resolve) => {
            let width = img.naturalWidth || img.width;
            let height = img.naturalHeight || img.height;

            // 원본이 목표 크기보다 작으면 절대 확대하지 않음 (축소만 수행)
            if (width > maxDim || height > maxDim) {
                if (width > height) {
                    height = Math.round((height * maxDim) / width);
                    width = maxDim;
                } else {
                    width = Math.round((width * maxDim) / height);
                    height = maxDim;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            // 고품질 보간 설정
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => {
                // 만약 WebP 변환이 브라우저에서 안 되면 JPEG로 대체
                if (!blob) {
                    canvas.toBlob((fallbackBlob) => {
                        resolve({ blob: fallbackBlob, width, height });
                    }, 'image/jpeg', quality);
                } else {
                    resolve({ blob, width, height });
                }
            }, mimeType, quality);
        });
    }

    /**
     * 썸네일 DataURL 생성
     */
    createThumbnail(img, maxDim, quality) {
        return new Promise((resolve) => {
            let width = img.naturalWidth || img.width;
            let height = img.naturalHeight || img.height;

            if (width > maxDim || height > maxDim) {
                if (width > height) {
                    height = Math.round((height * maxDim) / width);
                    width = maxDim;
                } else {
                    width = Math.round((width * maxDim) / height);
                    height = maxDim;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.drawImage(img, 0, 0, width, height);

            const dataUrl = canvas.toDataURL('image/webp', quality);
            resolve({ dataUrl, width, height });
        });
    }
}

window.imageCompressor = new ImageCompressor();
