# Low Cost Mocap (for drones)

### A general purpose motion capture system built from the ground up, used to autonomously fly multiple drones indoors

## YouTube Video
Watch this for information about the project & a demo!
[https://youtu.be/0ql20JKrscQ?si=jkxyOe-iCG7fa5th](https://youtu.be/0ql20JKrscQ?si=jkxyOe-iCG7fa5th)

[<img src="https://github.com/jyjblrd/Mocap-Drones/blob/main/images/thumbnail.png">](https://youtu.be/0ql20JKrscQ?si=jkxyOe-iCG7fa5th)

## Architectural Diagram
![](https://github.com/jyjblrd/Mocap-Drones/blob/main/images/architecture.png?raw=true)

## Dependencies
Install the pseyepy python library: [https://github.com/bensondaled/pseyepy](https://github.com/bensondaled/pseyepy)

install npm and yarn

## Runing the code

From the computer_code directory Run `yarn install` to install node dependencies 

Then run `yarn run dev` to start the webserver. You will be given a url view the frontend interface.

In another terminal window, run `python3 api/index.py` to start the backend server. This is what receives the camera streams and does motion capture computations.

## Documentation
The documentation for this project is admittedly pretty lacking, if anyone would like to put type definitions in the Python code that would be amazing and probably go a long way to helping the readability of the code. Feel free to also use the [discussion](https://github.com/jyjblrd/Mocap-Drones/discussions) tab to ask questions.

My blog post has some more information about the drones & camera: [joshuabird.com/blog/post/mocap-drones](https://joshuabird.com/blog/post/mocap-drones)

[This post](https://github.com/jyjblrd/Low-Cost-Mocap/discussions/11#discussioncomment-9380283) by gumby0q explains how `camera_params.json` can be calculated for your cameras.



## "Inside-Out" Multi-Agent Tracking (SLAM)
This motion capture system is an "outside-in" system, with external cameras tracking objects within a fixed space. There are also "inside-out" systems which use cameras on the drones/robots to determine their locations, not requiring any external infrastructure. 

My undergraduate dissertation presents such a system, which is capable of localizing multiple agents within a world in real time using purely visual data, with state-of-the-art performance. Check it out here: [https://github.com/jyjblrd/distributed_visual_SLAM](https://github.com/jyjblrd/distributed_visual_SLAM)
