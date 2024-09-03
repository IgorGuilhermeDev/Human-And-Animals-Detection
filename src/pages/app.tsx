import React, { useState, useEffect, useRef } from 'react';
import { Layout, Upload, message, Row, Col, Typography, Button } from 'antd';
import { UploadProps } from 'antd/es/upload';
import { InboxOutlined } from '@ant-design/icons';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs';
import { CSSProperties } from 'styled-components';

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { Dragger } = Upload;

const frameStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  overflow: 'hidden',
  margin: '20px auto',
  border: '10px solid #8c8c8c',
  borderRadius: '15px',
  boxShadow: '0 0 15px rgba(0, 0, 0, 0.5)',
};

const mediaStyle = {
  width: '100%',
  height: 'auto',
  display: 'block',
  borderRadius: '10px',
};

const VideoFrame = ({
  videoURL,
  originalVideoRef,
  grayscaleCanvasRef,
}: {
  videoURL: string;
  originalVideoRef: React.RefObject<HTMLVideoElement>;
  grayscaleCanvasRef: React.RefObject<HTMLCanvasElement>;
}) => (
  <Row justify="center" gutter={[16, 16]}>
    <Col span={12}>
      <div style={frameStyle}>
        <video
          ref={originalVideoRef}
          controls
          src={videoURL}
          style={mediaStyle}
        />
      </div>
    </Col>
    <Col span={12}>
      <div style={frameStyle}>
        <canvas ref={grayscaleCanvasRef} style={mediaStyle} />
      </div>
    </Col>
  </Row>
);

function App() {
  const [videoURL, setVideoURL] = useState<string | null>(null);
  const [personCount, setPersonCount] = useState<number>(0);
  const [childCount, setChildCount] = useState<number>(0);
  const [animalCount, setAnimalCount] = useState<number>(0);
  const originalVideoRef = useRef<HTMLVideoElement | null>(null);
  const grayscaleCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleVideoUpload: UploadProps['onChange'] = (info) => {
    if (info.file.status === 'done') {
      const url = URL.createObjectURL(info.file.originFileObj as Blob);
      setVideoURL(url);
      message.success(`${info.file.name} foi carregado com sucesso.`);
    } else if (info.file.status === 'error') {
      message.error(`${info.file.name} falha no carregamento.`);
    }
  };

  const handleRemoveVideo = () => {
    setVideoURL(null);
    setPersonCount(0);
    setChildCount(0);
    setAnimalCount(0);
  };

  const convertToGrayscale = (ctx: CanvasRenderingContext2D) => {
    const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const grayscale = 0.299 * r + 0.587 * g + 0.114 * b;

      data[i] = grayscale;
      data[i + 1] = grayscale;
      data[i + 2] = grayscale;
    }

    ctx.putImageData(imageData, 0, 0);
  };

  const drawBoundingBox = (
    ctx: CanvasRenderingContext2D,
    prediction: cocoSsd.DetectedObject,
    scaleX: number,
    scaleY: number,
    incrementCounters: { person: () => void; child: () => void; animal: () => void }
  ) => {
    const [x, y, width, height] = prediction.bbox;
    const scaledX = x * scaleX;
    const scaledY = y * scaleY;
    const scaledWidth = width * scaleX;
    const scaledHeight = height * scaleY;

    let color = 'yellow'; // Default color for other objects
    if (['cat', 'dog', 'horse', 'bird'].includes(prediction.class)) {
      color = 'red';
      incrementCounters.animal();
    } else if (prediction.class === 'person') {
      if (scaledWidth * scaledHeight < 15000) {
        color = 'blue';
        incrementCounters.child();
      } else {
        color = 'green';
        incrementCounters.person();
      }
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);

    ctx.font = '18px Arial';
    ctx.fillStyle = color;
    ctx.fillText(
      `${prediction.class} (${scaledX.toFixed(2)}, ${scaledY.toFixed(2)})`,
      scaledX + 5,
      scaledY - 10
    );
  };

  const detectObjects = async (
    videoElement: HTMLVideoElement,
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement
  ) => {
    const model = await cocoSsd.load();

    const detectFrame = async () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      convertToGrayscale(ctx);

      const predictions = await model.detect(canvas);

      // Reset counters for each frame
      let personCounter = 0;
      let childCounter = 0;
      let animalCounter = 0;

      const incrementCounters = {
        person: () => personCounter += 1,
        child: () => childCounter += 1,
        animal: () => animalCounter += 1,
      };

      predictions.forEach((prediction) => {
        const scaleX = canvas.width / videoElement.videoWidth;
        const scaleY = canvas.height / videoElement.videoHeight;
        drawBoundingBox(ctx, prediction, scaleX, scaleY, incrementCounters);
      });

      // Update the state with the counts from this frame
      setPersonCount(personCounter);
      setChildCount(childCounter);
      setAnimalCount(animalCounter);

      requestAnimationFrame(detectFrame);
    };

    videoElement.addEventListener('playing', detectFrame);
  };

  useEffect(() => {
    if (videoURL) {
      const videoElement = originalVideoRef.current;
      const canvas = grayscaleCanvasRef.current;
      if (!videoElement || !canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      videoElement.addEventListener('loadeddata', () => {
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;

        videoElement.addEventListener('play', () => {
          detectObjects(videoElement, ctx, canvas);
        });
      });
    }
  }, [videoURL]);


  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ color: 'white', textAlign: 'center' }}>
        <Title level={2} style={{ color: 'white', margin: 0 }}>
          Detecção de Humanos e Animais em Vídeo
        </Title>
      </Header>
      <Content
        style={{
          padding: '50px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
        }}
      >
        <div style={{ marginBottom: '20px' }}>
          <Text strong style={{ color: 'green' }}>
            Total de Pessoas: {personCount}
          </Text>
          <br />
          <Text strong style={{ color: 'blue' }}>
            Crianças: {childCount}
          </Text>
          <br />
          <Text strong style={{ color: 'red' }}>
            Animais: {animalCount}
          </Text>
        </div>
        <div style={{ width: '100%', maxWidth: '1200px' }}>
          {!videoURL && (
            <Dragger
              name="file"
              accept="video/*"
              customRequest={({ file, onSuccess }) => {
                setTimeout(() => onSuccess && onSuccess('ok'), 0);
              }}
              onChange={handleVideoUpload}
              style={{ padding: '20px', borderRadius: '10px' }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">
                Clique ou arraste o vídeo para esta área para enviar
              </p>
              <p className="ant-upload-hint">
                Suporte para um único arquivo de vídeo. O arquivo será processado para
                detecção de humanos e animais.
              </p>
            </Dragger>
          )}
          {videoURL && (
            <>
              <VideoFrame
                videoURL={videoURL}
                originalVideoRef={originalVideoRef}
                grayscaleCanvasRef={grayscaleCanvasRef}
              />
              <Button
                type="primary"
                danger
                onClick={handleRemoveVideo}
                style={{ marginTop: '20px' }}
              >
                Remover Vídeo
              </Button>
            </>
          )}
        </div>
      </Content>
    </Layout>
  );
}

export default App;
