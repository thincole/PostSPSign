# Tổng Hợp Bộ AI Prompt Template (`Veo3go` / `shopeevideo.py`) & Lệnh Tắt AI

Tài liệu này lưu trữ toàn bộ các mẫu **AI Prompt Template** tạo Ảnh tham chiếu `9:16`, Video TVC `8s`, và Video ghép nối liền mạch `16s` / `24s` (6 Sections chuẩn) trích xuất từ [`e:\ThinAptm0707\shopeevideo.py`](file:///e:/ThinAptm0707/shopeevideo.py).

---

## 1. Template Tạo Video TVC 8 Giây (`build_tvc_prompt`)

Các biến tự động thay thế:
- `{short_name}`: Tên sản phẩm đã làm sạch (tối đa 6 từ, bỏ ký tự đặc biệt và từ khóa vi phạm chính sách).
- `{nationality}`: Quốc tịch người mẫu (`Việt Nam`, `Filipino`, `Indonesian`, `Malaysian`, `American`).
- `{language}`: Ngôn ngữ nói (`tiếng Việt`, `Filipino`, `tiếng Indonesia`, `tiếng Malaysia (Bahasa Melayu)`, `English`).

### 1.1. Phong cách Mẫu Nữ (`VN`, `PH`, `ID`, `EN`)
```text
Create a product advertisement video (TVC) reviewing the product "{short_name}". A beautiful {nationality} woman, about 20 years old, holds the product and introduces its key benefits. She states the benefits right away without any introduction. She speaks {language}; no text is displayed in the video. The product is accurately sized. Her outfit is modest and appropriate, not revealing or offensive. The product price is not mentioned in the video.
```

### 1.2. Phong cách Mẫu Nam (Thị trường Malaysia - `MY`)
```text
Create a product advertisement video (TVC) reviewing the product "{short_name}". A handsome Malay male model, modest clothing (clean long-sleeve shirt, dark trousers), about 25 years old, holds the product and introduces its key benefits. He states the benefits right away without any introduction. He speaks tiếng Malaysia (Bahasa Melayu); no text is displayed in the video. The product is accurately sized. The product price is not mentioned in the video.
```

### 1.3. Phong cách Góc Nhìn Thứ Nhất (`POV` - Chỉ 2 bàn tay, không lộ mặt)
```text
Create a product advertisement video (TVC) reviewing the product "{short_name}". A first-person point of view (POV) shot looking down at a clean minimalist tabletop surface. ABSOLUTELY NO human face, NO head, NO presenter body visible. Only two clean, natural hands are visible holding, rotating, demonstrating, and interacting with the product. The hands smoothly showcase the key features, texture, and quality of the product. Voiceover speaks in {language} explaining the product benefits right away without any introduction; no text is displayed in the video. The product is accurately sized. The product price is not mentioned in the video.
```

### 1.4. Phong cách Đập Hộp (`Unboxing`)
```text
Create a product advertisement video (TVC) unboxing the product "{short_name}". A top-down desk camera angle looking down at a clean tabletop. ABSOLUTELY NO human face, NO head, NO presenter body visible. Only two clean, natural hands are visible carefully opening packaging, unboxing, and presenting the product. The hands smoothly showcase the product details, packaging, and craftsmanship. Voiceover speaks in {language} explaining the product benefits right away without any introduction; no text is displayed in the video. The product is accurately sized. The product price is not mentioned in the video.
```

### 1.5. Phong cách Demo Công Dụng (`Macro Close-up`)
```text
Create a product advertisement video (TVC) demonstrating the product "{short_name}". Extreme close-up macro shots focusing 100% on demonstrating and testing the product features, durability, and practical utility on a clean surface. ABSOLUTELY NO human face visible. Only clean hands interacting with and testing the product. Voiceover speaks in {language} explaining the product benefits right away without any introduction; no text is displayed in the video. The product is accurately sized. The product price is not mentioned in the video.
```

---

## 2. Template Tạo Ảnh Tham Chiếu 9:16 (`build_image_prompt`)

Các biến tự động thay thế:
- `{product_name}`: Tên sản phẩm.
- `{scene_en}`: Mô tả bối cảnh xung quanh.

### 2.1. Có Người Mẫu Cầm Sản Phẩm (Bản Tiếng Anh)
```text
Professional e-commerce product review photography of the model naturally holding and presenting '{product_name}', {scene_en}.
FRAMING LOCK: Full-frame vertical 9:16 portrait image, edge-to-edge real camera photo, ABSOLUTELY NO borders, NO black bars, NO white margins, NO gutters, NO divider lines, NO frame-within-frame, NO storyboard or collage layout.
MOST CRITICAL: The product '{product_name}' must be a PIXEL-PERFECT, EXACT DUPLICATE from the product reference image — preserve 100% of its shape, colors, logos, labels, textures, materials, and real-world proportions.
ALL text, letters, brand names, logos, and printed info on the product MUST be reproduced CHARACTER-BY-CHARACTER exactly as they appear — same font, size, position. DO NOT invent, replace, blur, or distort any text.
MODEL: Preserve the exact face shape, facial features, skin tone, and body build from the character reference image. Outfit is elegant, tasteful, modest, and complementary to the product.
Fingers wrap around the product naturally without obscuring key logos or labels.
Natural soft lighting, realistic smartphone camera realism, authentic lived-in environment. Photorealistic, ultra high resolution 8K commercial quality.
```

### 2.2. Có Người Mẫu Cầm Sản Phẩm (Bản Tiếng Việt)
```text
Ảnh chụp đánh giá sản phẩm thương mại điện tử chuyên nghiệp của người mẫu đang cầm và giới thiệu tự nhiên sản phẩm '{product_name}', {scene_en}.
FRAMING LOCK: Ảnh chân dung dọc full-frame 9:16 tràn viền, ảnh chụp máy ảnh thật edge-to-edge, TUYỆT ĐỐI KHÔNG viền đen, KHÔNG viền trắng, KHÔNG lề phụ, KHÔNG chia ô collage/storyboard, KHÔNG frame-within-frame.
QUAN TRỌNG NHẤT: Sản phẩm '{product_name}' phải là bản sao CHÍNH XÁC PIXEL-PERFECT từ ảnh sản phẩm tham chiếu — giữ nguyên 100% hình dạng, màu sắc, logo, nhãn mác, bao bì, chất liệu và tỷ lệ thực tế.
TẤT CẢ chữ viết, ký tự, tên thương hiệu in trên sản phẩm phải giữ nguyên TỪNG KÝ TỰ — cùng font, cùng kích cỡ, cùng vị trí. KHÔNG được bịa, thay thế, làm mờ, hay biến dạng chữ trên SP.
NGƯỜI MẪU: Giữ nguyên hình dáng khuôn mặt, đặc điểm gương mặt, màu da và vóc dáng từ ảnh người mẫu tham chiếu. Trang phục lịch sự, trang nhã, không hở hang, phù hợp với sản phẩm.
Ngón tay cầm/chạm sản phẩm tự nhiên, không che khuất logo hay nhãn mác chính.
Ánh sáng tự nhiên mềm mại, bối cảnh chân thực như chụp bằng smartphone đời thực, không có cảm giác AI giả tạo. Bố cục thương mại cao cấp, độ phân giải cao 8K.
```

### 2.3. Góc Nhìn Thứ Nhất `POV` / `Unboxing` (Bản Tiếng Anh)
```text
Professional e-commerce product review photography in first-person POV perspective, naturally showcasing '{product_name}', {scene_en}.
FRAMING LOCK: Full-frame vertical 9:16 portrait image, edge-to-edge real camera photo, ABSOLUTELY NO borders, NO black bars, NO white margins, NO gutters, NO divider lines, NO frame-within-frame, NO storyboard or collage layout.
MOST CRITICAL: The product '{product_name}' must be a PIXEL-PERFECT, EXACT DUPLICATE from the product reference image — preserve 100% of its shape, colors, logos, labels, textures, materials, and real-world proportions.
ALL text, letters, brand names, logos, and printed info on the product MUST be reproduced CHARACTER-BY-CHARACTER exactly as they appear — same font, size, position. DO NOT invent, replace, blur, or distort any text.
COMPOSITION & SUBJECT: First-person POV looking down at a clean minimalist tabletop. ABSOLUTELY NO human face, NO head, NO human body visible. ONLY a pair of neat, realistic human hands naturally interacting with, holding, or unboxing '{product_name}' on the desk.
Hands have normal five fingers each, natural realistic skin tone, holding the product cleanly without obscuring key logos or labels.
Natural soft lighting, realistic smartphone camera realism, authentic lived-in environment. Photorealistic, ultra high resolution 8K commercial quality.
```

### 2.4. Góc Nhìn Thứ Nhất `POV` / `Unboxing` (Bản Tiếng Việt)
```text
Ảnh chụp đánh giá sản phẩm thương mại điện tử chuyên nghiệp theo góc nhìn thứ nhất POV, giới thiệu '{product_name}', {scene_en}.
FRAMING LOCK: Ảnh chân dung dọc full-frame 9:16 tràn viền, ảnh chụp máy ảnh thật edge-to-edge, TUYỆT ĐỐI KHÔNG viền đen, KHÔNG viền trắng, KHÔNG lề phụ, KHÔNG chia ô collage/storyboard, KHÔNG frame-within-frame.
QUAN TRỌNG NHẤT: Sản phẩm '{product_name}' phải là bản sao CHÍNH XÁC PIXEL-PERFECT từ ảnh sản phẩm tham chiếu — giữ nguyên 100% hình dạng, màu sắc, logo, nhãn mác, bao bì, chất liệu và tỷ lệ thực tế.
TẤT CẢ chữ viết, ký tự, tên thương hiệu in trên sản phẩm phải giữ nguyên TỪNG KÝ TỰ — cùng font, cùng kích cỡ, cùng vị trí. KHÔNG được bịa, thay thế, làm mờ, hay biến dạng chữ trên SP.
BỐ CỤC & CHỦ THỂ: Góc nhìn thứ nhất POV nhìn xuống mặt bàn sạch sẽ. TUYỆT ĐỐI KHÔNG có khuôn mặt, KHÔNG đầu người, KHÔNG thân người mẫu. CHỈ CÓ đôi bàn tay người thật tự nhiên đang cầm, mở hộp hoặc thao tác nhẹ nhàng trên '{product_name}'.
Bàn tay có đúng 5 ngón bình thường, màu da tự nhiên, không che khuất logo hay nhãn mác chính.
Ánh sáng tự nhiên mềm mại, bối cảnh chân thực như chụp bằng smartphone đời thực, không có cảm giác AI giả tạo. Bố cục thương mại cao cấp, độ phân giải cao 8K.
```

---

## 3. Template Video Đa Phân Đoạn 6-Section (`16s` / `24s` Image-to-Video)

### 3.1. Khung Cố Định `SECTION 1` -> `SECTION 4` (Bản Tiếng Anh `_CONT_EN`)
```text
=== SECTION 1: GENERAL RULES & NEGATIVE CONSTRAINTS ===
[DIRECTIVES & PROMPT LOCKS]
- The video structure must strictly follow the Timeline Action descriptions with clean continuity.
- Ensure perfect temporal consistency — the character's face, body, clothing, and the product must remain 100% identical and stable across all frames with no morphing, no identity drift, and no sudden changes.
- The product is the primary focal point: It must remain clearly visible, properly framed, and in sharp focus throughout the entire video. Maintain its real-world proportions, colors, textures, and details.
- FRAMING LOCK: Generate a full-frame vertical 9:16 portrait video. The reference image must fill the entire frame edge-to-edge with NO letterboxing, NO pillarboxing, NO black bars, NO white borders, NO frame-within-frame effect, and NO empty side margins.
- PRODUCT CONSISTENCY LOCK: The product shown in frame 1 must be the EXACT SAME product in every subsequent frame. Its color, shape, size, material texture, and all distinguishing features must NOT change, swap, or gradually transform at any point in the video — especially in the final 1-2 seconds.
- The character naturally and fluidly interacts with the product as described in the Timeline Action. Movements must be smooth, realistic, and human — no robotic or unnatural motion, no slow-motion effects.
- ITEM PERSISTENCE & HAND LOCK: Any object the character holds or wears at the start must remain naturally present throughout. The character has exactly TWO normal human hands with five fingers each. Do NOT generate extra hands, extra arms, extra fingers, or limb deformations.

[NEGATIVE PROMPTS]
- No chaotic or unintended rapid morphing. Any camera transitions must feel deliberate, clean, and highly professional.
- ABSOLUTELY NO text, NO letters, NO numbers, NO subtitles, NO captions, NO titles, NO watermarks, NO logo overlays, NO HUD, NO UI graphics or artificial text overlays on screen.
- ABSOLUTELY NO gibberish, floating symbols, distorted text fonts, alien characters, or random numbers anywhere in the video frame.
- No letterbox, no pillarbox, no black bars, no white borders, no side margins, no divider lines, no collage layout, no storyboard layout, no comic-strip layout.
- No cartoon, anime, illustration, sketch, storyboard art, hand-drawn look, vector graphics, or stylized CGI. The output must stay natural photorealistic live-action footage.
- Color grading is strictly neutral and true-to-life, maintaining a clean white balance without unwanted color tints.
- No anatomical anomalies, no extra limbs, no extra hands, no extra fingers, no weird hand deformations.
- Do NOT remove, hide, or make any accessory disappear during the video.

=== SECTION 2: PRODUCT TO ADVERTISE ===
- Product: {name}
- If the attached image includes multiple objects, select ONLY ONE (1) main product as the focal item and ignore all other items.

=== SECTION 3: SUBJECT & CHARACTER CONSISTENCY ===
- Character: A 22-year-old {country_en} woman with a bright, cheerful face and natural beauty.
- Face & Features: Soft oval face shape, dark brown almond eyes, clear smooth skin, natural rosy blush.
- CRITICAL IDENTITY & OUTFIT LOCK: The presenter MUST be the EXACT SAME person matching the attached reference image with the EXACT SAME face structure, hairstyle, and exact clothing outfit across ALL segments. DO NOT change her identity, hair style, or clothing between clips.
- Voice & Tone: Standard {country_en} tone, lively, energetic, clear articulation, youthful.

=== SECTION 4: SCENE & ACTION SEQUENCE ===
- Environment: {scene}
```

### 3.2. Phần Tiếp Nối `SECTION 4` -> `SECTION 6` (Clip 1 & Clip 2 - Định Dạng `16s`)

#### Clip 1 (`0-8s`): Hook + Giới thiệu tính năng
```text
- Timeline Action for Segment 1 (0-8 seconds):
  * The character is a professional product reviewer, speaking confidently and engagingly with a cheerful expression.
  * Seconds 0-1 (ANCHOR FRAME): Start from the attached reference image as the anchor frame. Apply only a simple fade-in/brightness change. Preserve the reviewer identity, clothing, pose, hand placement, product, and background exactly; only minimal natural motion may begin (blink/breath).
  * Seconds 1-3 (PRODUCT INTRO): Front-facing camera. The character holds or gently touches '{name}' and begins speaking naturally. Keep the product fully visible in the frame.
  * Seconds 3-7 (FEATURE SHOWCASE): Still front-facing. The character highlights key details using subtle gestures: slight tilting/rotating of the product or a gentle pointing motion. Maintain stable framing.
  * Seconds 7-8 (CRITICAL RETURN TO REFERENCE & FREEZE): Front-facing camera. Cease all motion; the character and product must hold a completely static pose with zero movement. Both the reviewer and the product must remain in sharp focus and clearly visible within the frame. No morphing, no drifting of details.

=== SECTION 5: CAMERA & TECHNICAL SPECIFICATIONS ===
- Style: Professional product-review video with smooth camera movement and realistic smartphone-style material reproduction.
- Camera: Shot on a professional cinema/mirrorless camera, 4K UHD, 30fps, high dynamic range, tripod-stable with subtle gimbal stabilization.
- Color & Grading: Neutral color calibration, natural skin tones, crisp details, clean white balance, realistic optical depth of field.

=== SECTION 6: DIALOGUE & SPOKEN SCRIPT ===
- [{lang_instruction} throughout the video. The model must speak this exact dialogue: "{dialogue}"]
```

#### Clip 2 (`8-16s`): Cận cảnh chi tiết + Chốt đơn (CTA)
```text
- Timeline Action for Segment 2 (8-16 seconds):
  * This is a flawless, seamless continuation of the previous video. Start exactly from the static pose of the reference image.
  * The character remains generally in place, performing subtle, natural movements. Maintain character and setting consistency.
  * Seconds 8-10 (SEAMLESS RESUME): Maintain the camera angle from the attached image. Front view, focusing tightly on the character and the product '{name}'. The character speaks naturally.
  * Seconds 10-14 (CLOSE-UP DETAILS): Professional close-up shots of '{name}': texture, materials, buttons, detailed components.
  * Seconds 14-16 (CLOSING RECOMMENDATION): Return to the final front-facing shot with high clarity, where the product '{name}' and the reviewer appear sharp, clean, and well-lit. End with a confident, persuasive smile and recommendation.

=== SECTION 5: CAMERA & TECHNICAL SPECIFICATIONS ===
- Style: Professional product-review video with smooth camera movement and realistic smartphone-style material reproduction.
- Camera: Shot on a professional cinema/mirrorless camera, 4K UHD, 30fps, high dynamic range, tripod-stable with subtle gimbal stabilization.
- Color & Grading: Neutral color calibration, natural skin tones, crisp details, clean white balance, realistic optical depth of field.

=== SECTION 6: DIALOGUE & SPOKEN SCRIPT ===
- [{lang_instruction} throughout the video. The model must speak this exact dialogue: "{dialogue}"]
```

---

## 4. Cú Pháp Động Cơ Prompt (`PromptEngine` - Biến & Random)

Nếu dùng trong hệ thống `PromptTemplate` / `PromptEngine`:
- **Thay thế biến cố định**: `{ten_bien}` (ví dụ `{name}`, `{scene}`, `{dialogue}`).
- **Chọn ngẫu nhiên 1 giá trị trong danh sách (`choice`)**:
  ```text
  {choice:lựa chọn 1, lựa chọn 2, lựa chọn 3}
  ```

---

## 5. Các Lệnh Tắt (`/slash commands`) Trong Khung Chat AI Antigravity

| Lệnh tắt | Công dụng |
| :--- | :--- |
| `/plan` | Lập kế hoạch từng bước chi tiết trước khi bắt tay vào sửa code. |
| `/boost` | Bật chế độ suy nghĩ sâu, phân tích đa góc nhìn và kiểm thử nghiêm ngặt cho tác vụ khó. |
| `/goal` | Chạy tác vụ dài hơi liên tục cho tới khi đạt 100% mục tiêu. |
| `/teamwork` | Phối hợp nhiều Sub-Agent tự động chạy song song cho dự án lớn. |
| `/grill-me` | Phỏng vấn tương tác để chốt thiết kế và làm rõ mọi quyết định kỹ thuật. |
| `/learn` | Lưu lại bài học/quy tắc cấu hình vừa giải quyết để AI tự nhớ cho các phiên sau. |
| `/compact` | Tóm tắt và nén ngữ cảnh cuộc trò chuyện khi hội thoại quá dài. |
| `/schedule` | Tạo lịch chạy định kỳ (cron) hoặc bộ đếm hẹn giờ. |
| `/browser` | Sử dụng trình duyệt tự động để kiểm tra hoặc thao tác trên trang web. |
