function toggleStream() {
	streamView = document.getElementById("streamView");
	if (streamView.src.endsWith("/camera-stream"))
		streamView.src = '';
	else
		streamView.src = '/camera-stream';
}

export {toggleStream};
