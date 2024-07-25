#!/usr/bin/env python3

import os
import platform
import sys
import shutil
import time
import glob
import json
import threading
import cv2 as cv
import numpy as np
import tkinter as tk
from tkinter import ttk
from PIL import Image, ImageTk

from pseyepy import Camera
from pathlib import Path


def round_values(matrix, decimals=8):
	return np.round(matrix, decimals).tolist()

def empty_directory(dirpath):
	for file in os.listdir(dirpath):
		filepath = os.path.join(dirpath, file)
		try:
			if os.path.isfile(filepath) or os.path.islink(filepath):
				os.unlink(filepath)
			elif os.path.isdir(filepath):
				shutil.rmtree(filepath)
		except OSError as e:
			print(f"Failed to remove: {filepath}\n{e}")
			return False
	return True

def ensure_directory(dirpath):
	if Path(dirpath).exists():
		if Path(dirpath).is_dir():
			print(f"{dirpath} already exists. Emptying contents...")
			if not empty_directory(dirpath):
				return False
		else:
			try:
				Path(dirpath).unlink()
			except OSError as e:
				print(f"Failed to remove file {dirpath}\n{e}")
				return False
	else:
		try:
			Path(dirpath).mkdir()
		except OSError as e:
			print(f"Failed to create image directory: {dirpath}\ne")
			return False
	return True

class ScrolledFrame(tk.Frame):
	def __init__(self, parent, *args, **kw):
		tk.Frame.__init__(self, parent, *args, **kw)

		self.vsb = ttk.Scrollbar(self, orient="vertical")
		self.vsb.pack(side="right", fill="y")

		self.canvas = tk.Canvas(self, borderwidth=0, background="#ffffff", yscrollcommand=self.vsb.set)
		self.canvas.pack(side="left", fill="both", expand=True)

		self.vsb.config(command=self.canvas.yview)

		self.canvas_frame = tk.Frame(self.canvas, background="#ffffff")
		self.canvas.create_window((0, 0), window=self.canvas_frame, anchor="nw")

		self.canvas_frame.bind("<Configure>", self.on_frame_configure)

	def on_frame_configure(self, event=None):
		self.canvas.configure(scrollregion=self.canvas.bbox("all"))

	def clear(self):
		for widget in self.canvas_frame.winfo_children():
			widget.destroy()

	def add_image(self, img, row, col, delete_command):
		img_label = ttk.Label(self.canvas_frame, image=img)
		img_label.image = img  # keep a reference!
		img_label.grid(row=row, column=col, padx=5, pady=5)
		delete_button = ttk.Button(self.canvas_frame, text="Delete", command=delete_command)
		delete_button.grid(row=row + 1, column=col, padx=5, pady=5)


class CameraCalibratorApp:
	def __init__(self, root):
		self.cams = None
		self.num_cameras = 0
		self.camera_params = []
		self.calibrated_cameras = set()
		self.is_running = False
		self.is_collecting = False
		self.is_detecting = False
		self.is_calibrating = False
		self.root = root
		self.root.title("Camera Calibrator")

		root.attributes("-alpha", 0.85)
		if platform.system() == "Windows":
			icon_path = os.path.abspath("../assets/favicon.ico")
		elif platform.system() == "Linux":
			icon_path = os.path.abspath("../assets/icon.xbm")
		else:
			icon_path = None
		if icon_path is not None and os.path.isfile(icon_path):
			root.iconbitmap(bitmap=f"@{icon_path}")

		self.start_button = ttk.Button(root, text="Start Stream", command=self.start_camera)
		self.start_button.pack()
		self.video_label = ttk.Label(root)
		self.video_label.pack()

		self.camera_var = tk.StringVar()
		self.camera_select = ttk.Combobox(root, textvariable=self.camera_var)
		self.camera_select.pack()

		self.collect_button = ttk.Button(root, text="Collect samples", command=self.collect_samples, state=tk.DISABLED)
		self.collect_button.pack()
		self.detect_button = ttk.Button(root, text="Detect pattern", command=self.detect_pattern, state=tk.DISABLED)
		self.detect_button.pack()
		self.calibrate_button = ttk.Button(root, text="Calibrate camera", command=self.calibrate_camera, state=tk.DISABLED)
		self.calibrate_button.pack()
		self.output_button = ttk.Button(root, text="Output params", command=self.output_params, state=tk.DISABLED)
		self.output_button.pack()

		self.feedback_label = ttk.Label(root, text="Calibrated Cameras: None", anchor="w")
		self.feedback_label.pack(fill=tk.X, padx=5, pady=5)

		self.error_text = tk.Text(root, height=5, state=tk.DISABLED, wrap=tk.WORD)
		self.error_text.pack(fill=tk.X, padx=5, pady=5)
		self.error_text.grid_remove()

		self.images_frame = ttk.Frame(root)
		self.images_frame.pack(fill=tk.BOTH, expand=True)

		self.scrolled_frame = ScrolledFrame(root)
		self.scrolled_frame.pack(fill=tk.BOTH, expand=True)

	def start_camera(self):
		if not self.is_running:
			self.is_running = True
			self.cams = Camera(fps=90, resolution=Camera.RES_SMALL, exposure=100, gain=16)
			self.num_cameras = len(self.cams.exposure)
			self.camera_params = [None for _ in range(self.num_cameras)]
			self.calibrated_cameras = set()
			self.camera_select['values'] = [f'Camera {i}' for i in range(self.num_cameras)]
			self.camera_select.current(0)
			self.collect_button.config(state=tk.NORMAL)

			self.update_frame()

	def update_frame(self):
		if self.is_running:
			try:
				cam_index = int(self.camera_var.get().split()[-1])
				frame, _ = self.cams.read(cam_index, squeeze=False)
				frame = cv.cvtColor(frame, cv.COLOR_BGR2RGB)
				img = Image.fromarray(frame)
				imgtk = ImageTk.PhotoImage(image=img)
				self.video_label.imgtk = imgtk
				self.video_label.configure(image=imgtk)
			except Exception as e:
				self.show_error(f"Error: {e}")
				self.stop_camera()
			self.video_label.after(10, self.update_frame)

	def stop_camera(self):
		if self.is_running:
			self.is_running = False
			if self.cams:
				self.cams.end()
			self.video_label.configure(image='')
			self.collect_button.config(state=tk.DISABLED)
			self.detect_button.config(state=tk.DISABLED)
			self.calibrate_button.config(state=tk.DISABLED)
			self.camera_params = [None for _ in range(self.num_cameras)]
			self.calibrated_cameras.clear()

	def collect_samples(self):
		if not self.is_collecting:
			self.is_collecting = True
			self.collect_button.config(state=tk.DISABLED)
			self.calibrate_button.config(state=tk.DISABLED)
			cam_index = int(self.camera_var.get().split()[-1])
			threading.Thread(target=self._collect_samples, args=(cam_index,)).start()

	def delete_image(self, img_path):
		try:
			os.unlink(img_path)
		except OSError as e:
			self.show_error(f"Failed to delete {img_path}\n{e}")
		else:
			self.show_error(f"Deleted {img_path}")
			self.display_collected_images(os.path.dirname(img_path))

	def _collect_samples(self, cam_index=0, n_samples=42, wait_between_frames=0.3):
		img_dir = f"cam_{cam_index}"
		if not ensure_directory(img_dir):
			self.show_error("Error: failed to ensure collection directory")
			return False
		for i in range(n_samples):
			frame, _ = self.cams.read(cam_index)
			filename = f"{img_dir}/image_{i}.jpg"
			cv.imwrite(filename, frame)
			time.sleep(wait_between_frames)
		self.display_collected_images(img_dir)
		self.is_collecting = False
		self.collect_button.config(state=tk.NORMAL)
		self.detect_button.config(state=tk.NORMAL)
		return True

	def display_collected_images(self, img_dir):
		self.scrolled_frame.clear()

		row, col = 0, 0
		for img_file in sorted(os.listdir(img_dir)):
			img_path = os.path.join(img_dir, img_file)
			if img_path.endswith(('.jpg', '.jpeg')):
				img = Image.open(img_path)
				imgtk = ImageTk.PhotoImage(img)
				delete_command = lambda p=img_path: self.delete_image(p)
				self.scrolled_frame.add_image(imgtk, row, col, delete_command)

				col += 1
				if col == 4:  # TODO: dynamically scaled layout
					col = 0
					row += 2

		self.scrolled_frame.on_frame_configure()

	def detect_pattern(self):
		if not self.is_detecting:
			self.is_detecting = True
			self.collect_button.config(state=tk.DISABLED)
			self.detect_button.config(state=tk.DISABLED)
			self.calibrate_button.config(state=tk.DISABLED)
			cam_index = int(self.camera_var.get().split()[-1])
			threading.Thread(target=self._detect_pattern, args=(cam_index,)).start()

	def _detect_pattern(self, cam_index=0):
		img_dir = f"cam_{cam_index}"
		calibrated_dir = f"cam_{cam_index}_c"
		if not ensure_directory(calibrated_dir):
			self.show_error("Error: failed to ensure calibration directory")
			return False
		# Checkerboard dimensions
		CHECKERBOARD = (5, 6)
		# termination criteria
		criteria = (cv.TERM_CRITERIA_EPS + cv.TERM_CRITERIA_MAX_ITER, 30, 0.001)
		self.objpoints = []
		self.imgpoints = []
		# prepare object points, like (0,0,0), (1,0,0), (2,0,0) ....,(6,5,0)
		objp = np.zeros((CHECKERBOARD[0] * CHECKERBOARD[1], 3), np.float32)
		objp[:,:2] = np.mgrid[0:CHECKERBOARD[0], 0:CHECKERBOARD[1]].T.reshape(-1,2)
		images = glob.glob(f"{img_dir}/*.jpg")
		for fname in images:
			img = cv.imread(fname)
			gray = cv.cvtColor(img, cv.COLOR_BGR2GRAY)
			# Find the chess board corners
			ret, corners = cv.findChessboardCorners(gray, CHECKERBOARD, None)
			# If found, add object points, image points (after refining them)
			if ret == True:
				self.objpoints.append(objp)
				corners2 = cv.cornerSubPix(gray,corners, (11,11), (-1,-1), criteria)
				self.imgpoints.append(corners2)
				# Draw and display the corners
				cv.drawChessboardCorners(img, CHECKERBOARD, corners2, ret)
				frame_filename = f"{calibrated_dir}/{os.path.basename(fname)}"
				cv.imwrite(frame_filename, img)

		self.is_detecting = False
		self.collect_button.config(state=tk.NORMAL)
		self.detect_button.config(state=tk.NORMAL)
		self.calibrate_button.config(state=tk.NORMAL)
		self.display_collected_images(calibrated_dir)

	def calibrate_camera(self):
		if not self.is_calibrating:
			self.is_calibrating = True
			self.collect_button.config(state=tk.DISABLED)
			self.detect_button.config(state=tk.DISABLED)
			self.calibrate_button.config(state=tk.DISABLED)
			cam_index = int(self.camera_var.get().split()[-1])
			threading.Thread(target=self._calibrate_camera, args=(cam_index,)).start()

	def _calibrate_camera(self, cam_index=0):
		if not len(self.objpoints) or not len(self.imgpoints):
			self.show_error("Error: Missing points for calibration")
			return
		calibrated_dir = f"cam_{cam_index}_c"
		images = glob.glob(f"{calibrated_dir}/*.jpg")
		if not images:
			self.show_error("No samples to calibrate")
			return
		gray_shape = None
		try:
			first_img = cv.imread(images[0])
			if first_img is None:
				raise ValueError("Failed to read image")
			gray = cv.cvtColor(first_img, cv.COLOR_BGR2GRAY)
			gray_shape = gray.shape[::-1]
		except Exception as e:
			self.show_error(f"Error reading or processing images: {e}")
			return

		try:
			ret, mtx, dist, rvecs, tvecs = cv.calibrateCamera(self.objpoints, self.imgpoints, gray_shape, None, None)
			if not ret:
				raise ValueError("Calibration failed")
		except Exception as e:
			self.show_error(f"Error during calibration: {e}")
			return

		mtx = round_values(mtx)
		dist = round_values(dist)
		params = {
			"intrinsic_matrix": mtx,
			"distortion_coef": dist,
			"rotation": 0
		}
		print(f"Camera params: {params}")
		self.collect_button.config(state=tk.NORMAL)
		self.detect_button.config(state=tk.NORMAL)
		self.calibrate_button.config(state=tk.NORMAL)
		self.output_button.config(state=tk.NORMAL)
		self.objpoints = []
		self.imgpoints = []
		self.camera_params[cam_index] = params
		self.calibrated_cameras.add(cam_index)
		self.update_feedback()

	def update_feedback(self):
		calibrated_list = ', '.join([f'Camera {i}' for i in sorted(self.calibrated_cameras)])
		if calibrated_list:
			self.feedback_label.config(text=f"Calibrated Cameras: {calibrated_list}")
		else:
			self.feedback_label.config(text="Calibrated Cameras: None")

	def show_error(self, message):
		self.error_text.config(state=tk.NORMAL)
		self.error_text.delete(1.0, tk.END)
		self.error_text.insert(tk.END, message + '\n')
		self.error_text.config(state=tk.DISABLED)
		self.error_text.grid()

	def output_params(self):
		filename = "camera-params.json"
		if self.camera_params is not None:
			try:
				f = open(filename, 'w')
			except OSError as e:
				self.show_error(f"Failed to open {filename}\n{e}")
			else:
				with f as file:
					json.dump(self.camera_params, file, indent=4)

	def on_camera_change(self, event=None):
		self.scrolled_frame.clear()
		self.collect_button.config(state=tk.NORMAL)
		self.detect_button.config(state=tk.DISABLED)
		self.calibrate_button.config(state=tk.DISABLED)
		self.output_button.config(state=tk.DISABLED)
		self.objpoints = []
		self.imgpoints = []


if __name__ == "__main__":
	root = tk.Tk()
	app = CameraCalibratorApp(root)
	root.protocol("WM_DELETE_WINDOW", app.stop_camera)
	app.camera_select.bind("<<ComboboxSelected>>", app.on_camera_change)
	root.mainloop()
